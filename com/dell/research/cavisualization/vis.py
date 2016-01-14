#!/usr/bin/env python2

import os

try:
    import gevent
    from gevent.wsgi import WSGIServer
    from gevent.queue import Queue

    from flask import Flask, Response, request, render_template
    
    from netifaces import interfaces, ifaddresses, AF_INET
except ImportError, e:
    print str(e)
    exit(-1)

# SSE "protocol" is described here: http://mzl.la/UPFyxY
class ServerSentEvent(object):

    def __init__(self, data):
        self.data = data
        self.event = None
        self.id = None
        self.desc_map = {
            self.data : "data",
            self.event : "event",
            self.id : "id"
        }

    def encode(self):
        if not self.data:
            return ""
        lines = ["%s: %s" % (v, k) 
                 for k, v in self.desc_map.iteritems() if k]
        
        return "%s\n\n" % "\n".join(lines)

# Make sure to launch this program in the folder containing the templates folder
my_path = os.path.dirname(os.path.realpath(__file__))
base_path = os.path.join(my_path, '..', '..', '..', '..')
app = Flask(__name__, static_folder=os.path.join(base_path, 'static'), static_url_path='/static', template_folder=os.path.join(base_path, 'templates'))
subscriptions = []

# Client code consumes like this.
@app.route("/")
def index():
    return render_template('index.html', title='Visualization', ifaces=get_iface_addresses())

@app.route("/demopost/",methods=['POST'])
def demopost():
    #Dummy data - pick up from request for real data
    def notify(req):
        msg = str(req)
        for sub in subscriptions[:]:
            sub.put(msg)
    
    gevent.spawn(notify, request.data)
    
    return "OK"

@app.route("/subscribe")
def subscribe():
    def gen():
        q = Queue()
        subscriptions.append(q)
        try:
            while True:
                result = q.get()
                ev = ServerSentEvent(str(result))
                yield ev.encode()
        except GeneratorExit: # Or maybe use flask signals
            subscriptions.remove(q)

    return Response(gen(), mimetype="text/event-stream")

# Returns a list of network interface names and addresses
def get_iface_addresses():
    ifaces_addresses = []
    
    for iface in interfaces():
        address = [i['addr'] for i in ifaddresses(iface).setdefault(AF_INET, [{'addr':'None'}] )]
        
        # Ignore loopback address
        if address[0] != '127.0.0.1':
            ifaces_addresses.append({'name': iface, 'address': address[0]})
        
    return ifaces_addresses

if __name__ == "__main__":
    app.debug = False
    server = WSGIServer(("", 5000), app)
    server.serve_forever()
    # Then visit http://localhost:5000 to subscribe 
    # and send messages by visiting http://localhost:5000/publish
