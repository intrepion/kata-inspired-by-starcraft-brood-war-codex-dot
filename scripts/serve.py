#!/usr/bin/env python3
"""Session-only detached localhost server. No boot/login registration."""
import os, socket, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
port=int(sys.argv[1]) if len(sys.argv)>1 else 5203
with socket.socket() as sock:
    try: sock.bind(('127.0.0.1',port))
    except OSError as error: raise SystemExit(f'Cannot bind port {port}: {error}. Existing servers preserved.')
with open(root/'server.log','ab') as log:
    p=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(root/'dist')],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,close_fds=True)
(root/'.server.pid').write_text(str(p.pid))
print(f'PID {p.pid}; http://127.0.0.1:{port}')
