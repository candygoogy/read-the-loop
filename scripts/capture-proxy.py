"""A local logging proxy: see exactly what Claude Code sends the model.

Usage: python scripts/capture-proxy.py <out-dir> [--port 8765]

Listens on 127.0.0.1 and forwards every request to https://api.anthropic.com unchanged. Responses,
including streamed (SSE) ones, are passed back as they arrive. Point one claude process at it with
ANTHROPIC_BASE_URL=http://127.0.0.1:<port>, set for that process only.

It saves only the request bodies of POST /v1/messages calls, byte for byte, one file per request
(<out-dir>/001.json, 002.json, ...). It never saves headers: they carry the auth token. Nothing else
is written. Stop it with Ctrl+C.

If the upstream can't be reached or fails before answering, the client gets a 502 with an
Anthropic-style error body, so claude reports (or retries) an API error instead of a dropped
connection. If the upstream fails or the client hangs up mid-response, the proxy logs it and closes
that connection: once the response has started, no status can be sent any more.
"""
import argparse
import http.client
import http.server
import itertools
import json
import pathlib
import sys
import threading

UPSTREAM = "api.anthropic.com"
# Headers that belong to one connection, not to the request; http.client and we set our own.
HOP = {"connection", "keep-alive", "proxy-connection", "proxy-authorization", "te", "trailer",
       "transfer-encoding", "upgrade", "host"}


class Proxy(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    out_dir: pathlib.Path
    upstream = UPSTREAM  # host[:port]; the tests point it at a closed port
    counter = itertools.count(1)
    lock = threading.Lock()

    def do_request(self):
        body = self.read_body()
        if self.command == "POST" and self.path.split("?")[0] == "/v1/messages":
            with self.lock:
                n = next(self.counter)
            (self.out_dir / f"{n:03}.json").write_bytes(body)
            print(f"capture-proxy: saved request {n:03} ({len(body):,} bytes)", file=sys.stderr)

        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
        up = http.client.HTTPSConnection(self.upstream, timeout=600)
        try:
            try:
                up.request(self.command, self.path, body=body or None, headers=headers)
                resp = up.getresponse()
            except (OSError, http.client.HTTPException) as e:
                self.upstream_failed(e)
                return
            try:
                self.relay(resp)
            except (OSError, http.client.HTTPException) as e:
                # The status line is already out, so dropping the connection is the only signal left.
                print(f"capture-proxy: response cut off ({type(e).__name__}: {e}); closing the connection",
                      file=sys.stderr)
                self.close_connection = True
        finally:
            up.close()

    def upstream_failed(self, e):
        msg = f"capture-proxy could not get an answer from {self.upstream}: {type(e).__name__}: {e}"
        print("capture-proxy:", msg, file=sys.stderr)
        body = json.dumps({"type": "error", "error": {"type": "api_error", "message": msg}}).encode()
        try:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except OSError:  # the client is gone too
            self.close_connection = True

    def relay(self, resp):
        self.send_response(resp.status, resp.reason)
        for k, v in resp.getheaders():
            if k.lower() not in HOP and k.lower() != "content-length":
                self.send_header(k, v)
        if self.command == "HEAD" or resp.status in (204, 304):  # no body allowed
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_header("Transfer-Encoding", "chunked")  # works for streamed and whole bodies alike
        self.end_headers()
        while chunk := resp.read1(65536):  # read1: hand on whatever has arrived, don't wait for more
            self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
            self.wfile.flush()
        self.wfile.write(b"0\r\n\r\n")

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = do_request

    def read_body(self):
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            parts = []
            while size := int(self.rfile.readline().split(b";")[0], 16):
                parts.append(self.rfile.read(size))
                self.rfile.readline()
            while self.rfile.readline() not in (b"\r\n", b"\n", b""):  # trailers
                pass
            return b"".join(parts)
        return self.rfile.read(int(self.headers.get("Content-Length") or 0))

    def log_message(self, fmt, *args):  # the default log line is fine: method, path, status. No headers.
        print("capture-proxy:", fmt % args, file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("out_dir")
    p.add_argument("--port", type=int, default=8765)
    a = p.parse_args()
    out = pathlib.Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        sys.exit(f"{out} is not empty; use a fresh folder per recording.")
    Proxy.out_dir = out
    server = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), Proxy)
    print(f"capture-proxy: listening on http://127.0.0.1:{a.port}, saving to {out}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
