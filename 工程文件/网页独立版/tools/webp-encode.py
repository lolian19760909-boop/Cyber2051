#!/usr/bin/env python3
"""把资源包里的 PNG 转成 WebP（标准画质层）。只在构建期运行，产物和回执留在 generated/。"""
import argparse, hashlib, json, os, sys, tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def convert_one(job):
    source, target, quality, source_bytes, source_sha, out = job
    os.makedirs(os.path.dirname(target), exist_ok=True)
    tmp = target + '.tmp'
    try:
        with Image.open(source) as image:
            if getattr(image, 'n_frames', 1) > 1:
                return {'sourceId': source_sha, 'skipped': 'animated'}
            if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
                image = image.convert('RGBA')
            else:
                image = image.convert('RGB')
            image.save(tmp, 'WEBP', quality=quality, method=6, exact=True)
        size = os.path.getsize(tmp)
        if size >= source_bytes * 1.01:
            os.unlink(tmp)
            return {'sourceId': source_sha, 'skipped': 'not-smaller', 'bytes': size}
        os.replace(tmp, target)
        return {'sourceId': source_sha, 'id': sha256_file(target), 'bytes': size,
                'url': os.path.relpath(target, os.path.dirname(out)).replace(os.sep, '/')}
    except Exception as error:
        try:
            if os.path.exists(tmp):
                os.unlink(tmp)
        except OSError:
            pass
        return {'sourceId': source_sha, 'error': str(error)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--source-root', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--quality', type=int, default=92)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    with open(args.manifest, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    receipt = {'schema': 1, 'quality': args.quality, 'method': 6, 'files': {}}
    if os.path.exists(args.receipt):
        try:
            with open(args.receipt, 'r', encoding='utf-8') as f:
                old = json.load(f)
            if old.get('quality') == args.quality:
                receipt['files'] = old.get('files', {})
        except Exception:
            pass
    jobs, total = [], 0
    for row in manifest.get('resources', {}).get('files', []):
        if row.get('mime') != 'image/png':
            continue
        total += 1
        source = os.path.join(args.source_root, row['url'])
        target = os.path.join(args.out, row['id'][:16], row['id'] + '.webp')
        old = receipt['files'].get(row['id'])
        if old and (old.get('skipped') or (old.get('id') and os.path.exists(target) and os.path.getsize(target) == old.get('bytes'))):
            continue
        jobs.append((source, target, args.quality, row['bytes'], row['id'], args.out))
    print(f'webp: {total} png, {len(jobs)} to convert', flush=True)
    done = 0
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(convert_one, job) for job in jobs]
        for future in as_completed(futures):
            result = future.result()
            done += 1
            sid = result.get('sourceId')
            if sid:
                receipt['files'][sid] = result
            if done % 25 == 0 or done == len(futures):
                with open(args.receipt + '.tmp', 'w', encoding='utf-8') as f:
                    json.dump(receipt, f, ensure_ascii=False, separators=(',', ':'))
                os.replace(args.receipt + '.tmp', args.receipt)
                print(f'webp: {done}/{len(futures)}', flush=True)
    with open(args.receipt + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(receipt, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(args.receipt + '.tmp', args.receipt)
    errors = sum(1 for v in receipt['files'].values() if v.get('error'))
    skipped = sum(1 for v in receipt['files'].values() if v.get('skipped'))
    print(f'webp: done, {len(receipt["files"])} records, {skipped} skipped, {errors} errors', flush=True)
    return 1 if errors else 0

if __name__ == '__main__':
    raise SystemExit(main())
