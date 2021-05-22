from os import sep
from socket import socket
from socket import error
from socket import AF_INET
from socket import SOCK_STREAM
from socket import SHUT_RDWR
from socket import SHUT_WR
from threading import Thread
from threading import Lock
from MessageSending import send_message
import math 

#main processing class
class MyVertex(Thread):
    _max_dist = 10000
    
    #init all data
    def __init__(self, ID):
        super().__init__();
        #flag to stop listening thread
        self._stop_running = False;
        #vertex ID
        self._ID = ID
        self._lock = Lock();
        #parent vertex info
        self._parent_id = -1;
        self._parent_port = 0;
        self._parent_ip = '';

        self._neighbors = [];

        #create server socket
        self._server = socket(AF_INET, SOCK_STREAM);

        #msg list to other vertexes
        self._msg_list = [];

        #read vertex info
        input_file_name = 'input_vertex_' + str(ID)+'.txt';
        input_file = open(input_file_name, 'r');
        self._vertex_count = int(input_file.readline());
        self._tcp_port = int(input_file.readline());
        self._total_weight = int(input_file.readline());
        self._dist = self._max_dist;

        #read neighbor vertex info
        while(True):
            str_port = input_file.readline();
            if(str_port[0] == '*'):
                break;
            self._neighbors.append({'tcp_port': int(str_port), 'ip': input_file.readline().strip('\n'), 'dist':self._max_dist, 'weight': 0});
        input_file.close();

        self._nbr_count = len(self._neighbors);
        self._child_count = 0;
        #start tcp server thread
        self.start()

    #set the current vertex to origin
    def set_origin(self):
        self._parent_id = 0;
        self._dist = 0;

    #get message from the message list
    def get_message(self):
        msg = None
        self._lock.acquire();
        if(len(self._msg_list)):
            msg = self._msg_list[0];
            self._msg_list = self._msg_list[1:]
        self._lock.release();
        return msg;
    #push message to the list
    def push_message(self, msg):
        self._lock.acquire();
        self._msg_list.append(msg);
        self._lock.release();

    #make distance request msg
    def make_get_dist_msg(self):
        return 'req_dist ' + str(self._ID) +' ' + str(self._tcp_port);

    #send distance request msg to all neighbors
    def send_get_dist_msg(self):
        msg = self.make_get_dist_msg();
        for nbr in self._neighbors:
            send_message(msg, nbr['tcp_port'], nbr['ip'])

    #make distance response msg 
    def make_send_dist_msg(self):
        return 'res_dist ' + str(self._ID) + ' '+ str(self._tcp_port) +' ' + str(self._dist);

    #send distance response msg
    def send_my_dist_msg(self, port, ip):
        msg = self.make_send_dist_msg();
        send_message(msg, port, ip);
    #make dist calculated msg
    def make_dist_finished_msg(self):
        return 'distfinished'+' ' + str(self._ID) + ' '+ str(self._tcp_port) + ' ' + str(self._parent_id);

    #send dist calculated msg to all neighbors
    def send_dist_finished_msg(self):
        msg = self.make_dist_finished_msg();
        for nbr in self._neighbors:
            send_message(msg, nbr['tcp_port'], nbr['ip'])

    #make weight calculated message
    def make_weight_msg(self):
        return 'weight'+ ' ' + str(self._ID) + ' '+ str(self._tcp_port) + ' ' + str(self._total_weight);
    
    #send weight message
    def send_weight_msg(self):
        msg = self.make_weight_msg();
        if(self._parent_port):
            send_message(msg, self._parent_port, self._parent_ip);

    #check if the msg list is empty
    def check_empty(self):
        is_empty = False;
        self._lock.acquire();
        if(len(self._msg_list) == 0):
            is_empty = True;
        self._lock.release();
        return is_empty;

    def run(self):
        #bind the port
        self._server.bind(('', self._tcp_port));
        self._server.listen(10);
        
        while(self._stop_running == False):
            try:
                #listen and accept
                conn, addr = self._server.accept();
                
                #receive data from others
                msg = conn.recv(1024);
                #push message to the list
                self._lock.acquire();
                self._msg_list.append({'ip': addr[0], 'msg': msg.decode()});
                self._lock.release();
                conn.shutdown(SHUT_RDWR);
            except error:
                break;
        self._server.close();

    #calculate dist from all neighbors
    def calculate_dist(self):
        self._updated_nbr_count = 0
        self._rcv_count = 0;
        dist = {}
        #send dist request msg
        self.send_get_dist_msg();
        while self._updated_nbr_count != self._nbr_count:
            
            #if received all, resend request
            if self._rcv_count == self._nbr_count:
                self.send_get_dist_msg();
                self._rcv_count = 0

            #get one msg
            msg = self.get_message();
            if msg:
                sender_ip = msg['ip'];
                #split the message into the data
                data = msg['msg'].split(' ');
                sender_cmd = data[0];
                sender_id = int(data[1]);
                sender_port = int(data[2]);
                #data = cmd sender_id sender_port extra info...
                
                #if request, send self dist
                if sender_cmd == 'req_dist':
                    self.send_my_dist_msg(sender_port, sender_ip);
                #if response, update self info
                elif sender_cmd == 'res_dist':
                    self._rcv_count += 1;
                    sender_dist = int(data[3])
                    #check if it can be parent
                    if self._dist > sender_dist + 1:
                        self._dist = sender_dist + 1
                        self._parent_id = sender_id;
                        self._parent_ip = sender_ip
                        self._parent_port = sender_port;
                    
                    
                    prev_dist = self._max_dist
                    if sender_id in dist.keys():
                        prev_dist = dist[sender_id]
                    
                    #check if the neighbor is updated, and increase the updated count
                    if prev_dist == self._max_dist and sender_dist != self._max_dist:
                        self._updated_nbr_count += 1;
                    dist[sender_id] = sender_dist
                #if msg not process, append again
                else:
                    self.push_message(msg)

    #wait all neighbors to calculate the dist 
    def wait_all_dist_calculated(self):
        self._updated_nbr_count = 0
        while self._updated_nbr_count != self._nbr_count:
            msg = self.get_message();
            if msg:
                sender_ip = msg['ip'];
                #split the message into the data
                data = msg['msg'].split(' ');
                sender_cmd = data[0];
                sender_id = int(data[1]);
                sender_port = int(data[2]);
                #data = cmd sender_id sender_port extra info...
                #if dist request, then send the self dist
                if sender_cmd == 'req_dist':
                    self.send_my_dist_msg(sender_port, sender_ip);
                #if neighbor is finished calculating dist, then increase _updated_nbr_count
                elif sender_cmd == 'distfinished':
                    sender_parent = int(data[3])
                    self._updated_nbr_count += 1
                    if sender_parent == self._ID:
                        self._child_count += 1;
                else:#if msg not process, append again
                    self.push_message(msg)
    #calculate its sub tree weight
    def calculate_weight(self):
        self._updated_nbr_count = 0
        #wait for all child to finish calculating
        while self._child_count != self._updated_nbr_count:
            msg = self.get_message();
            if msg:
                sender_ip = msg['ip'];
                #split the message into the data
                data = msg['msg'].split(' ');
                sender_cmd = data[0];
                sender_id = int(data[1]);
                sender_port = int(data[2]);
                #if child send weight info, then update the total weight and increase updated count
                if sender_cmd == 'weight':
                    self._total_weight += int(data[3])
                    self._updated_nbr_count += 1

    #main routine to process
    def process_msg(self):
        #calculate the distance from the origin
        self.calculate_dist();
        
        #send the dist is calculted
        self.send_dist_finished_msg()
        
        #wait for all neighbors to calculate their distance 
        self.wait_all_dist_calculated();
        
        #calculate subtree weight
        self.calculate_weight();
        
        #send the subtree sum weight
        self.send_weight_msg();

        #save data to file
        self.save_result();
        
        #if all data is saved at all, kill the listening thread
        self.kill_thread();
    
    #kill listening thread
    def kill_thread(self):
        self._lock.acquire()
        self._stop_running = True;
        self._server.close();
        self._lock.release()
    
    #save the result to file
    def save_result(self):
         with open('output_vertex_' + str(self._ID) + '.txt', 'w') as file:
            file.write(str(self._dist) + '\n')
            file.write((str(self._parent_id) if self._parent_id != 0 else 'root') + '\n');
            file.write(str(self._total_weight) + '\n');
            file.close();

    #routine to export
def vertex(ID):
    my_vertex = MyVertex(ID);
    if(ID == 1):
        my_vertex.set_origin();

    my_vertex.process_msg();

#test function
def test():
    threads = []
    ids=range(1,9)
    for ID in ids:
        threads.append(Thread(target=vertex, args=(ID,)))
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
#it can be run directly to test
if __name__ == '__main__':
    test()