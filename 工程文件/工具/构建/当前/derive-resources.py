"""Create reproducible player encodings from the retained P4 master archive.

This changes file encoding and (for large backgrounds) delivery resolution only.
Portrait canvases, alpha, framing, and all UI pixels remain intact. No master is edited.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import time
from urllib.parse import unquote
import zipfile
from PIL import Image, ImageChops

ENGINEERING = Path(__file__).resolve().parents[3]
PROFILE = {"backgroundMaxEdge": 1920, "backgroundQuality": 92,
           "portraitQuality": 94, "portraitResize": False, "alpha": "lossless",
           "ui": "lossless-pixel-identical", "format": "webp", "method": 6}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def encode(item):
    entry, data = item
    names = [unquote(a.rsplit("/", 1)[-1]) for a in entry.get("aliases", [])]
    group = "background" if any(n.startswith("2051CG_") for n in names) else (
        "portrait" if any("_tachi_" in n for n in names) else "ui")
    image = Image.open(io.BytesIO(data))
    original_size = image.size
    start = time.perf_counter()
    changed = False
    if group in ("ui", "background", "portrait"):
        image.load()
        if group == "background":
            image.thumbnail((PROFILE["backgroundMaxEdge"], PROFILE["backgroundMaxEdge"]), Image.Resampling.LANCZOS)
            if image.mode == "RGBA" and image.getchannel("A").getextrema() == (255, 255):
                image = image.convert("RGB")
        target = io.BytesIO()
        options = {"lossless": True} if group == "ui" else {"quality": PROFILE[group + "Quality"]}
        image.save(target, format="WEBP", method=PROFILE["method"], exact=True, **options)
        candidate = target.getvalue()
        decoded = Image.open(io.BytesIO(candidate)).convert("RGBA")
        expected = image.convert("RGBA")
        if decoded.size != expected.size or ImageChops.difference(decoded.getchannel("A"), expected.getchannel("A")).getbbox():
            raise ValueError("Alpha or dimensions changed: " + entry["id"])
        if group == "ui" and any(high for low, high in ImageChops.difference(decoded, expected).getextrema()):
            raise ValueError("Lossless UI pixels changed: " + entry["id"])
        if len(candidate) < len(data):
            data, changed = candidate, True
    resource_id = digest(data)
    mime = "image/webp" if changed else entry["mime"]
    result = {"id": resource_id, "mime": mime, "bytes": len(data),
              "file": resource_id + "." + mime.split("/")[1], "aliases": entry.get("aliases", [])}
    provenance = {"sourceId": entry["id"], "id": resource_id, "group": group, "names": names,
                  "sourceBytes": entry["bytes"], "bytes": len(data), "sourceSize": original_size,
                  "size": image.size if changed else original_size, "mime": mime, "alphaExact": True,
                  "pixelsExact": group == "ui" or not changed,
                  "canvasAnchor": "unchanged", "deviceSelection": "shared-desktop-mobile",
                  "seconds": round(time.perf_counter() - start, 3)}
    return result, data, provenance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ENGINEERING / ".cache/resource-derivatives230/P4玩家资源包.zip")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    source = ENGINEERING / "资源/P4基础资源包.zip"
    source_bytes = source.read_bytes()
    with zipfile.ZipFile(io.BytesIO(source_bytes)) as archive:
        original = json.loads(archive.read("manifest.json"))
        inputs = [(e, archive.read(e["file"])) for e in original["entries"]]
    for entry, data in inputs:
        if len(data) != entry["bytes"] or digest(data) != entry["id"]:
            raise ValueError("Master manifest mismatch: " + entry["id"])
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as executor:
        for result in executor.map(encode, inputs):
            results.append(result)
            if len(results) % 32 == 0:
                print(json.dumps({"encoded": len(results), "total": len(inputs)}), flush=True)
    entries = [r[0] for r in results]
    manifest_id = digest(json_bytes(entries))
    manifest = {"schema": 1, "version": "2.3.0", "id": manifest_id,
                "baseUrl": "https://cyber2051.top/resources/2.3.0/" + manifest_id + "/", "entries": entries}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, "w", compression=zipfile.ZIP_STORED) as archive:
        # Fixed timestamps make archive bytes independent of the generation time.
        for name, data in [("manifest.json", json_bytes(manifest))] + [(e["file"], data) for e, data, _ in results]:
            archive.writestr(zipfile.ZipInfo(name, (2026, 10, 17, 0, 0, 0)), data)
    receipt = {"schema": 1, "profile": PROFILE, "sourceSHA256": digest(source_bytes),
               "sourceManifest": original["id"], "manifest": manifest_id,
               "sourceBytes": sum(e["bytes"] for e in original["entries"]),
               "bytes": sum(e["bytes"] for e in entries), "archiveBytes": args.output.stat().st_size,
               "archiveSHA256": digest(args.output.read_bytes()), "assets": [r[2] for r in results]}
    args.output.with_suffix(".json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in receipt.items() if k != "assets"}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
