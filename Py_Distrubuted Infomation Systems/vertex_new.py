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


class GraphVertex(Thread):
    MAX_DISTANCE= 10000
    
    #constructor
    def __init__(self, ID):
        
        #init thread class 
        super().__init__();

        self.vertex_id = ID

        self.neighbor_array = [];

        #message list from neighbors
        self.message_from_nbrs = [];

        #read vertex info
        file_name = 'input_vertex_' + str(ID)+'.txt';
        file = open(file_name, 'r');
        self.total_vertex_count = int(file.readline());
        self.listening_port = int(file.readline());
        self.subtree_weight = int(file.readline());
        self.dist_from_origin = self.MAX_DISTANCE;

        #read all neighbor info
        line = ''
        while(True):
            line = file.readline();
            if(line[0] == '*'):
                break;
            self.neighbor_array.append({'port': int(line), 'ip': file.readline().strip('\n'), 'dist':self.MAX_DISTANCE, 'sub_tree_wieght': 0});
        file.close();

        self.child_neighbor_count = 0;
        
        #create locker
        self.locker = Lock();
        #vertex info of parent
        self.parent_id = -1;
        self.parent_port = 0;
        self.parent_ip = '';

        self.tcp_server = socket(AF_INET, SOCK_STREAM);
        #flag to stop tcp server
        self.stop_listening = False;
        #start thread to listen and save the msg
        self.start()

        if(ID == 1):
            self.set_origin_vertex();

    #set the current vertex to origin
    def set_origin_vertex(self):
        self.dist_from_origin = 0;
        self.parent_id = 0;

    #send message to get neighbors' distance
    def send_dist_req_message(self):
        message = ' '.join(['request_dist',
                         str(self.vertex_id),
                         str(self.listening_port)])
        for neighbor in self.neighbor_array:
            send_message(message, neighbor['port'], neighbor['ip'])

    #send message with its dist
    def send_dist_res_message(self, port, ip):
        message = ' '.join(['response_dist',
                         str(self.vertex_id),
                         str(self.listening_port),
                         str(self.dist_from_origin)])
        send_message(message, port, ip);

    #send message to notify neighbors that its dist is calculated correctly
    def sebd_dist_calced_message(self):
        message = ' '.join(['finish_dist',
                            str(self.vertex_id),
                            str(self.listening_port),
                            str(self.parent_id)]);
        for neighbor in self.neighbor_array:
            send_message(message, neighbor['port'], neighbor['ip'])

    #send message to the parent that its sub tree weight is calculated correctly
    def send_subtree_weight_message(self):
        message = ' '.join(['sub_tree_wieght', 
                            str(self.vertex_id),
                            str(self.listening_port),
                            str(self.subtree_weight)]);
        if(self.parent_port):
            send_message(message, self.parent_port, self.parent_ip);

    #pop message
    def pop_message_from_list(self):
        message = None
        self.locker.acquire();
        if(len(self.message_from_nbrs)):
            message = self.message_from_nbrs[0];
            self.message_from_nbrs = self.message_from_nbrs[1:]
        self.locker.release();
        return message;

    #push message
    def push_message_to_list(self, message):
        self.locker.acquire();
        self.message_from_nbrs.append(message);
        self.locker.release();

    #tcp server thread routine to receive message from neighbors
    def run(self):
        #establish the tcp server
        self.tcp_server.bind(('', self.listening_port));
        self.tcp_server.listen(10);
        
        while(self.stop_listening == False):
            try:
                #listen and accept
                nbr_conn, address = self.tcp_server.accept();
                
                #receive data from others
                message = nbr_conn.recv(500);
                #push message to the list
                self.locker.acquire();
                self.message_from_nbrs.append({'ip': address[0], 'message': message.decode()});
                self.locker.release();
                nbr_conn.shutdown(SHUT_RDWR);
            except error:
                break;
        self.tcp_server.close();

    #calculate its dist correctly
    def calculate_dist(self):
        self.neighbor_finished_count = 0
        self._rcv_count = 0;
        neighbor_distances = {}
        #send message to all neighbors to get their distance
        self.send_dist_req_message();
        while self.neighbor_finished_count != len(self.neighbor_array):
            
            #when it received all response, send request again
            if self._rcv_count == len(self.neighbor_array):
                self.send_dist_req_message();
                self._rcv_count = 0

            #pop one message
            message = self.pop_message_from_list();
            if message:
                source_ip = message['ip'];
                #get data from message
                data_splitted = message['message'].split(' ');
                source_cmd = data_splitted[0];
                source_id = int(data_splitted[1]);
                source_port = int(data_splitted[2]);
                #data = command source_id source_port extra info...
                
                #if req message, send self dist
                if source_cmd == 'request_dist':
                    self.send_dist_res_message(source_port, source_ip);
                
                #if res message, update parent info and its distance
                elif source_cmd == 'response_dist':
                    self._rcv_count += 1;
                    source_dist = int(data_splitted[3])
                    #check if it can be parent
                    if self.dist_from_origin > source_dist + 1:
                        self.dist_from_origin = source_dist + 1
                        self.parent_id = source_id;
                        self.parent_ip = source_ip
                        self.parent_port = source_port;
                    
                    
                    distance_t = self.MAX_DISTANCE
                    if source_id in neighbor_distances.keys():
                        distance_t = neighbor_distances[source_id]
                    
                    #check if the neighbor is updated, and increase the updated count
                    if distance_t == self.MAX_DISTANCE and source_dist != self.MAX_DISTANCE:
                        self.neighbor_finished_count += 1;

                    neighbor_distances[source_id] = source_dist
                else:
                    #push message which not processed above
                    self.push_message_to_list(message)
        
        #send the dist is calculted
        self.sebd_dist_calced_message()
        
        #wait for all neighbors to finish their distance 
        self.wait_all_dist_calculated();

    #wait all neighbors to calculate the dist 
    def wait_all_dist_calculated(self):
        self.neighbor_finished_count = 0
        while self.neighbor_finished_count != len(self.neighbor_array):
            message = self.pop_message_from_list();
            if message:
                source_ip = message['ip'];
                #split the message into the data
                data_splitted = message['message'].split(' ');
                source_cmd = data_splitted[0];
                source_port = int(data_splitted[2]);

                if source_cmd == 'request_dist':
                    self.send_dist_res_message(source_port, source_ip);
                elif source_cmd == 'finish_dist':
                    source_parent = int(data_splitted[3])
                    self.neighbor_finished_count += 1
                    if source_parent == self.vertex_id:
                        self.child_neighbor_count += 1;
                else:
                    self.push_message_to_list(message)

    #calculate its sub tree weight
    def calculate_weight(self):
        self.neighbor_finished_count = 0
        #get weight from its children
        while self.child_neighbor_count != self.neighbor_finished_count:
            message = self.pop_message_from_list();
            if message:
                #get data from message
                data_splitted = message['message'].split(' ');
                source_cmd = data_splitted[0];
                if source_cmd == 'sub_tree_wieght':
                    self.subtree_weight += int(data_splitted[3])
                    self.neighbor_finished_count += 1
        
        #send the subtree sum weight
        self.send_subtree_weight_message();
    #main routine to process
    def main_routine(self):
        #calculate the distance from the origin
        self.calculate_dist();

        #calculate its weight from child neighors
        self.calculate_weight();

        #algorithm is finished now for all of my children
        self.save_subtree();
        
        self.kill_tcp_server_thread();

    #terminate tcp server thread
    def kill_tcp_server_thread(self):
        self.locker.acquire()
        self.stop_listening = True;
        self.tcp_server.close();
        self.locker.release()

    #save subtree weight to file
    def save_subtree(self):
         with open('output_vertex_' + str(self.vertex_id) + '.txt', 'w') as out_file:
            out_file.write('\n'.join([str(self.dist_from_origin),
                                (str(self.parent_id) if self.parent_id != 0 else 'root'),
                                str(self.subtree_weight)]));
            out_file.close();

def vertex(ID):
    graph_vertex = GraphVertex(ID);

    graph_vertex.main_routine();
