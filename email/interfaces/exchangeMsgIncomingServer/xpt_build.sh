SDK_DIR="/E/software/xulrunner-31.0.en-US.win32.sdk/xulrunner-sdk/sdk"
echo $SDK_DIR
python $SDK_DIR/bin/typelib.py  -I $SDK_DIR/../idl -o mivExchangeMsgIncomingServer.xpt mivExchangeMsgIncomingServer.idl