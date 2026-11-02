from __future__ import annotations

import base64
import os
from pathlib import Path

import yaml


def dagu_sidecar_path(script_path: Path) -> Path:
    return script_path.with_suffix(".dagu.yml")


def render_dagu_sidecar(rendered_script: str, *, project_dir: str) -> str:
    script_bytes = (rendered_script + "\n").encode("utf-8")
    script_payload = base64.b64encode(script_bytes).decode("ascii")
    decoder = f"""\
const scriptEncoded = {script_payload!r};
function decodeBase64(value) {{
  const pattern = new RegExp(
    '^(?:[A-Za-z0-9+/]{{4}})*(?:[A-Za-z0-9+/]{{2}}==|[A-Za-z0-9+/]{{3}}=)?$'
  );
  if (value.length % 4 !== 0 || !pattern.test(value)) {{
    throw new Error('Invalid base64 payload');
  }}
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let buffer = 0;
  let bits = 0;
  let percent = '';
  for (const char of value) {{
    if (char === '=') break;
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {{
      bits -= 8;
      percent += '%' + ((buffer >> bits) & 255).toString(16).padStart(2, '0');
    }}
  }}
  if (bits && (buffer & ((1 << bits) - 1)) !== 0) throw new Error('Invalid base64 payload');
  try {{
    return decodeURIComponent(percent);
  }} catch (error) {{
    throw new Error('Invalid UTF-8 payload');
  }}
}}
function toOctal(value) {{
  // Keep shell and Dagu syntax out of the interpolated file.write content.
  const encoded = encodeURIComponent(value);
  let result = '';
  for (let index = 0; index < encoded.length; index += 1) {{
    let byte;
    if (encoded[index] === '%') {{
      byte = parseInt(encoded.slice(index + 1, index + 3), 16);
      index += 2;
    }} else {{
      byte = encoded.charCodeAt(index);
    }}
    result += '\\\\' + byte.toString(8).padStart(3, '0');
  }}
  return result;
}}
const script = decodeBase64(scriptEncoded);
const args = JSON.parse(decodeBase64(input.args));
if (!Array.isArray(args)) {{
  throw new Error('harness_args_b64 must encode an array of strings without NUL');
}}
if (args.some((item) =>
  typeof item !== 'string' || item.includes('\\0')
)) {{
  throw new Error('harness_args_b64 must encode an array of strings without NUL');
}}
return {{
  script: toOctal(script),
  argv: toOctal(args.length ? args.join('\\0') + '\\0' : '')
}};
"""
    document = {
        "params": [
            {"name": "project_dir", "type": "string", "default": project_dir},
            {
                "name": "harness_args_b64",
                "type": "string",
                "default": "W10=",
            },
        ],
        "working_dir": "${params.project_dir}",
        "steps": [
            {
                "id": "decode_payload",
                "action": "js.run",
                "with": {
                    "input": {"args": "${params.harness_args_b64}"},
                    "script": decoder,
                },
                "output": {
                    "payload": {"from": "stdout", "decode": "json"},
                },
            },
            {
                "id": "write_harness",
                "depends": ["decode_payload"],
                "action": "file.write",
                "with": {
                    "path": "${context.paths.work_dir}/harness.sh",
                    "content": "${decode_payload.output.payload.script}",
                    "mode": "0700",
                    "overwrite": True,
                },
            },
            {
                "id": "write_argv",
                "depends": ["decode_payload"],
                "action": "file.write",
                "with": {
                    "path": "${context.paths.work_dir}/argv.bin",
                    "content": "${decode_payload.output.payload.argv}",
                    "mode": "0600",
                    "overwrite": True,
                },
            },
            {
                "id": "execute_harness",
                "depends": ["write_harness", "write_argv"],
                "env": {
                    "ARGV_PATH": "${context.paths.work_dir}/argv.bin",
                    "HARNESS_PATH": "${context.paths.work_dir}/harness.sh",
                },
                "run": """#!/usr/bin/env bash
set -euo pipefail
set --
decode_octal() {
  local encoded_path="$1"
  local decoded_path="$2"
  local encoded
  encoded="$(<"$encoded_path")"
  printf '%b' "$encoded" > "$decoded_path"
}
decode_octal "${env.HARNESS_PATH}" "${env.HARNESS_PATH}.decoded"
chmod 700 "${env.HARNESS_PATH}.decoded"
mv -f -- "${env.HARNESS_PATH}.decoded" "${env.HARNESS_PATH}"
decode_octal "${env.ARGV_PATH}" "${env.ARGV_PATH}.decoded"
chmod 600 "${env.ARGV_PATH}.decoded"
mv -f -- "${env.ARGV_PATH}.decoded" "${env.ARGV_PATH}"
while IFS= read -r -d '' argument; do
  set -- "$@" "$argument"
done < "${env.ARGV_PATH}"
exec bash -- "${env.HARNESS_PATH}" "$@"
""",
            },
        ],
    }
    return yaml.safe_dump(document, sort_keys=False, allow_unicode=True)


def default_project_dir(sidecar_path: Path) -> str:
    return os.path.relpath(Path.cwd(), sidecar_path.absolute().parent)
