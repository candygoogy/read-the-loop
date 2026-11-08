"""Tests for scripts/capture-proxy.py. Run with: python -m unittest discover tests"""
import http.client
import http.server
import importlib.util
import json
import pathlib
import socket
import sys
import tempfile
import threading
import unittest

REPO = pathlib.Path(__file__).resolve().parent.parent
TMP_BASE = REPO / "out" / "test-tmp"


def load_proxy():
    spec = importlib.util.spec_from_file_location("capture_proxy", REPO / "scripts" / "capture-proxy.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def closed_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class CaptureProxyTest(unittest.TestCase):
    def test_unreachable_upstream_gives_a_502_api_error(self):
        mod = load_proxy()
        TMP_BASE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP_BASE) as t:
            Proxy = type("Proxy", (mod.Proxy,), {"out_dir": pathlib.Path(t),
                                                 "upstream": f"127.0.0.1:{closed_port()}"})
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            stderr, sys.stderr = sys.stderr, open(pathlib.Path(t) / "log.txt", "w", encoding="utf-8")
            try:
                c = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=30)
                body = b'{"model":"x","messages":[]}'
                c.request("POST", "/v1/messages", body=body, headers={"Content-Type": "application/json"})
                r = c.getresponse()
                self.assertEqual(r.status, 502)
                err = json.loads(r.read())
                self.assertEqual((err["type"], err["error"]["type"]), ("error", "api_error"))
                # The request body is still saved, byte for byte; the connection stays usable.
                self.assertEqual((pathlib.Path(t) / "001.json").read_bytes(), body)
                c.request("GET", "/v1/models")
                self.assertEqual(c.getresponse().status, 502)
                c.close()
            finally:
                server.shutdown()
                server.server_close()
                sys.stderr.close()
                sys.stderr = stderr


if __name__ == "__main__":
    unittest.main()
