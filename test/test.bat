set node_file=%~dp0..\moztest\node\index.js
node %node_file% %~dp0test_config.json
pause
