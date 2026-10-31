"""Lossless, non-executing JSON card extraction and rebuild tool."""

import argparse
import copy
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def pretty(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def card_bytes(value, manifest):
    data = pretty(value)
    return data if manifest["source"]["trailingNewline"] else data[:-1]


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def parse(data):
    return json.loads(data.decode("utf-8"), object_pairs_hook=no_duplicate_keys)


def safe_file(root, relative):
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Unsafe component path: {relative}")
    result = (root / path).resolve()
    if not result.is_relative_to(root.resolve()):
        raise ValueError(f"Component path escapes workspace: {relative}")
    return result


def write(root, relative, data):
    path = safe_file(root, relative)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return sha(data)


def tokens(pointer):
    if not pointer.startswith("/"):
        raise ValueError(f"Invalid JSON pointer: {pointer}")
    return [part.replace("~1", "/").replace("~0", "~") for part in pointer[1:].split("/")]


def put(root, pointer, value):
    parts = tokens(pointer)
    parent = root
    for part in parts[:-1]:
        parent = parent[int(part)] if isinstance(parent, list) else parent[part]
    last = parts[-1]
    if isinstance(parent, list):
        index = int(last)
        if index != len(parent):
            raise ValueError(f"Array order or duplicate pointer: {pointer}")
        parent.append(value)
    else:
        if last not in parent:
            raise ValueError(f"Missing target field: {pointer}")
        parent[last] = value


def add_text(parts, root, relative, pointers, value, kind):
    if not isinstance(value, str):
        raise ValueError(f"Expected text at {pointers[0]}")
    data = value.encode("utf-8")
    parts.append({
        "kind": kind,
        "pointers": pointers,
        "file": relative,
        "sourceSha256": sha(canonical(value)),
        "fileSha256": write(root, relative, data),
    })


def add_object(parts, root, prefix, pointer, value, kind, content_field):
    if not isinstance(value, dict) or not isinstance(value.get(content_field), str):
        raise ValueError(f"Unexpected object structure at {pointer}")
    metadata = copy.deepcopy(value)
    content = metadata[content_field]
    metadata[content_field] = ""
    json_file = f"components/{prefix}.json"
    content_file = f"components/{prefix}.txt"
    parts.append({
        "kind": kind,
        "pointers": [pointer],
        "id": value.get("id"),
        "label": value.get("comment", value.get("scriptName", value.get("name", ""))),
        "file": json_file,
        "contentField": content_field,
        "contentFile": content_file,
        "sourceSha256": sha(canonical(value)),
        "fileSha256": write(root, json_file, pretty(metadata)),
        "contentSha256": write(root, content_file, content.encode("utf-8")),
    })


def compose(workspace):
    manifest = parse((workspace / "manifest.json").read_bytes())
    card = parse(safe_file(workspace, manifest["baseFile"]).read_bytes())
    seen = set()
    for part in manifest["parts"]:
        data = safe_file(workspace, part["file"]).read_bytes()
        if "contentField" in part:
            value = parse(data)
            field = part["contentField"]
            if field not in value or not isinstance(value[field], str):
                raise ValueError(f"Missing text field in {part['file']}")
            value[field] = safe_file(workspace, part["contentFile"]).read_bytes().decode("utf-8")
        else:
            value = data.decode("utf-8")
        for pointer in part["pointers"]:
            if pointer in seen:
                raise ValueError(f"Duplicate JSON pointer: {pointer}")
            seen.add(pointer)
            put(card, pointer, copy.deepcopy(value))
    return card


def extract(source, workspace):
    source = source.resolve(strict=True)
    workspace = workspace.resolve()
    if source.suffix.lower() != ".json" or not source.is_file():
        raise ValueError("Input must be one JSON file")
    if workspace.exists() or workspace == source or workspace in source.parents or source in workspace.parents:
        raise ValueError("Output must be a new directory separate from the input")
    raw = source.read_bytes()
    card = parse(raw)
    data = card["data"]
    book = data["character_book"]
    ext = data["extensions"]
    helper = ext["tavern_helper"]
    if card["first_mes"] != data["first_mes"]:
        raise ValueError("Top-level and data first_mes differ; cannot share one source file")
    workspace.mkdir(parents=True)
    snapshot = workspace / "snapshot" / source.name
    snapshot.parent.mkdir()
    shutil.copyfile(source, snapshot)
    snapshot.chmod(0o444)
    write(workspace, "decoded/card.json", pretty(card))

    base = copy.deepcopy(card)
    base["first_mes"] = ""
    base["data"]["first_mes"] = ""
    base["data"]["alternate_greetings"] = []
    base["data"]["character_book"]["entries"] = []
    base["data"]["extensions"]["regex_scripts"] = []
    base["data"]["extensions"]["tavern_helper"]["scripts"] = []
    base_file = "components/card-base.json"
    base_hash = write(workspace, base_file, pretty(base))

    parts = []
    add_text(parts, workspace, "components/opening/first_mes.txt", ["/first_mes", "/data/first_mes"], card["first_mes"], "opening")
    for index, value in enumerate(data["alternate_greetings"]):
        add_text(parts, workspace, f"components/opening/alternate/{index:03}.txt", [f"/data/alternate_greetings/{index}"], value, "alternate_greeting")
    for index, value in enumerate(book["entries"]):
        add_object(parts, workspace, f"worldbook/{index:03}", f"/data/character_book/entries/{index}", value, "worldbook_entry", "content")
    for index, value in enumerate(ext["regex_scripts"]):
        add_object(parts, workspace, f"regex/{index:03}", f"/data/extensions/regex_scripts/{index}", value, "regex_script", "replaceString")
    for index, value in enumerate(helper["scripts"]):
        add_object(parts, workspace, f"helper/{index:03}", f"/data/extensions/tavern_helper/scripts/{index}", value, "helper_script", "content")

    manifest = {
        "format": "tavernweave-card-workspace-v1",
        "extractor": {"name": "card_workspace.py", "version": "1", "command": "extract"},
        "source": {
            "file": source.name,
            "bytes": len(raw),
            "sha256": sha(raw),
            "trailingNewline": raw.endswith(b"\n"),
            "modifiedUtc": datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).isoformat(),
            "spec": card.get("spec"),
            "specVersion": card.get("spec_version"),
        },
        "baseFile": base_file,
        "baseFileSha256": base_hash,
        "parts": parts,
    }
    write(workspace, "manifest.json", pretty(manifest))
    rebuilt = compose(workspace)
    if canonical(card) != canonical(rebuilt):
        raise ValueError("Extraction round trip changed card data")
    write(workspace, "roundtrip/card.json", card_bytes(rebuilt, manifest))
    if sha(source.read_bytes()) != manifest["source"]["sha256"]:
        raise ValueError("Original input changed during extraction")
    print(f"Extracted {len(parts)} parts; semantic round trip passed; source SHA-256 {sha(raw)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    extract_cmd = commands.add_parser("extract")
    extract_cmd.add_argument("--input", type=Path, required=True)
    extract_cmd.add_argument("--output", type=Path, required=True)
    build_cmd = commands.add_parser("build")
    build_cmd.add_argument("--workspace", type=Path, required=True)
    build_cmd.add_argument("--output", type=Path, required=True)
    verify_cmd = commands.add_parser("verify")
    verify_cmd.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "extract":
        extract(args.input, args.output)
    elif args.command == "build":
        workspace = args.workspace.resolve(strict=True)
        output = args.output.resolve()
        roundtrip = (workspace / "roundtrip" / "card.json").resolve()
        if output.is_relative_to(workspace) and output != roundtrip:
            raise ValueError("Build output inside workspace must be roundtrip/card.json")
        if output.exists() and output != roundtrip:
            raise ValueError("Build output already exists; refusing to overwrite it")
        manifest = parse((workspace / "manifest.json").read_bytes())
        data = card_bytes(compose(workspace), manifest)
        compatibility = Path(__file__).resolve().parents[2] / "测试" / "宿主" / "check.cjs"
        subprocess.run(["node", str(compatibility), "--stdin"], input=data, check=True)
        write(output.parent, output.name, data)
        print(f"Built {output}")
    else:
        workspace = args.workspace.resolve(strict=True)
        metadata = parse((workspace / "manifest.json").read_bytes())["source"]
        snapshot = (workspace / metadata["path"]).resolve() if "path" in metadata else workspace / "snapshot" / metadata["file"]
        snapshot_bytes = snapshot.read_bytes()
        manifest = parse((workspace / "manifest.json").read_bytes())
        if sha(snapshot_bytes) != manifest["source"]["sha256"]:
            raise ValueError("Original snapshot hash differs from manifest")
        original = parse(snapshot_bytes)
        rebuilt = compose(workspace)
        if canonical(original) != canonical(rebuilt):
            raise ValueError("Current components differ from the original snapshot")
        exact = snapshot_bytes == card_bytes(rebuilt, manifest)
        print(f"Semantic round trip passed; byte equality: {exact}; original snapshot unchanged")


if __name__ == "__main__":
    main()
