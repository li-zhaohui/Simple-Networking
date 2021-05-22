import os
import platform
import socket
import multiprocessing
import subprocess
import urllib.request
import requests
import netifaces

system = platform.system()

#execute external command and return output of console result
def sys_call(command):
    return bytearray(subprocess.Popen(command, stdout = subprocess.PIPE).communicate()[0]).decode()

#get vendor info of network device from its mac address
def get_mac_details(mac_address): 
    # We will use an API to get the vendor details 
    url = "https://api.macvendors.com/"

    # Use get method to fetch details 
    response = requests.get(url+mac_address) 
    return response.content.decode() 
#thread routine to check if the host is alive or offline
def pinger(job_q, results_q):
	"""
	Do Ping
	:param job_q:
	:param results_q:
	:return:
	"""

	while True:
		
		input_data = job_q.get()
		if input_data is None:
			break

		#get ip and max address from input 
		ip = input_data[0]
		mac = input_data[1]

		#make ping command to send ICMP packet only once
		try:
			if (system != 'Linux'):
				ping_cmd = ['ping', '-n', '1', ip ]
			else:
				ping_cmd = ['ping', '-c', '1', ip ]
			output = sys_call(ping_cmd)

			##when ping is finished , then get the device name
			host_name = 'Unknown-Device'
			try:
				#get host name form ip address
				host_name = socket.gethostbyaddr(ip)[0]
			except Exception:
				pass
			#if gettting host name is failed, then get their vendor info instead
			if host_name == 'Unknown-Device' or host_name == '_gateway':
				try:
					host_name = 'errors'
					#the vendor support site blocks all of the frequent request so we have to check result
					while ('errors' in str(host_name)) == True:
						host_name = get_mac_details(mac)
				except Exception:
					pass
			#check the ping result and decide the state of host
			if 'TTL=' in output.upper():
				results_q.put([host_name, ip, 'online'])
			elif 'unreachable' in output.lower():
				results_q.put([host_name, ip, 'offline'])
		except Exception:
				break
#get public ip of owner 
def get_public_ip():
	"""
	Find my IP address
	:return:
	"""

	s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
	s.connect(("8.8.8.8", 80))
	ip = s.getsockname()[0]
	s.close()
	return ip

#get private ip of owner eg 127.0.0.1
def get_private_ip():
	priavte_ip = socket.gethostbyname(socket.gethostname())

	return priavte_ip

#check if the owner is connected to internet or lan
def check_internet(b_disp=True):
	if b_disp:
		print("Checking internet connection")
	try:

		ip_addr=socket. gethostbyname(socket. gethostname())
		if ip_addr == "127.0.0.1":
			if b_disp:
				print("Not connected to LAN")
			return False
		try:
			#We have to assume the google is always online
			urllib.request.urlopen("http://google.com", timeout = 1)
			if b_disp:
				print ("Connected to internet")
			return True
		except :
			if b_disp:
				print("Not connected to internet")
			return True
	except Exception:
		if b_disp:
			print("Not connected to LAN")
	return False
#extract string the length of which is valid
#it occurs when the string is splitted
def validate_list(str_list):
	out_list = []
	for str in str_list:
		if len(str) != 0:
			out_list.append(str)
	return out_list

#main routine to scan network
def scan_network(pool_size = 50):
	"""
	Maps the network
	:param pool_size: amount of parallel ping processes
	:return: list of valid ip addresses
	"""
	
	device_list = list()
	#when the internet or lan is not, return
	if check_internet(False) == False:
		return device_list

	try:

		#get all info of owner
		gateway_ip = netifaces.gateways()['default'][netifaces.AF_INET][0]
		device_list.append(["Default Gateway",  gateway_ip,"online"])
		
		private_ip = get_private_ip()
		device_list.append(["Private Host", private_ip,  "online"])

		# get my IP and sub_net like 192.168.1.255
		ip_parts = get_public_ip().split('.')
		sub_net = ip_parts[0] + '.' + ip_parts[1] + '.' + ip_parts[2] + '.'+'255'
	except:
		return device_list
	#subprocess.Popen(["ping ", sub_net], stdout = subprocess.PIPE).communicate()	

	#this is useless now
	
#	try:
#		if system == 'Windows':
#				sys_call("ipconfig")
#		elif system == 'Linux':
#			sys_call("ifconfig")
#		elif system == 'MacOS':
#			return
#		else:
#			pass
#	except Exception:
#		return

	ip_list = list()

	#get all ip addresses from arp cache
	arp_cache = sys_call(["arp", "-a"])

	for str_line in arp_cache.split('\n'):
		if len(str_line) < 5:
			continue
		info_list = validate_list(str_line.split(' '))

		#insert ip and mac to the searching list
		if system == 'Windows' and info_list[2] == 'dynamic':
			ip_list.append((info_list[0], info_list[1]))
		elif system == 'Linux':
			ip = info_list[1].replace('(','').replace(')', '')
			mac = info_list[3]
			ip_list.append([ip, mac])

	# prepare the jobs queue
	jobs = multiprocessing.Queue()
	results = multiprocessing.Queue()

	#subprocess will be create, and maximum number is pool_size
	#so there are pool_size of thread at the same time
	pool = [multiprocessing.Process(target=pinger, args=(jobs, results)) for i in range(pool_size)]

	for p in pool:
		p.start()

	# cue hte ping processes
#	for i in range(1, 200):
#		jobs.put(base_ip + '{0}'.format(i))

	#check pre-found ip list
	for ip in ip_list:
		jobs.put(ip)

	for p in pool:
		jobs.put(None)

	for p in pool:
		p.join()

	# collect he results
	while not results.empty():
		result = results.get()
		device_list.append(result)
	
	return device_list
#display host info
def display_dev_info(idx, dev_info):
    print("{:3} {:40} {:15} {}".format(idx, dev_info[0], dev_info[1], dev_info[2]))

#display all host info
def display_def_list(dev_list, disp_mode):
	print("{} {:40} {:15} {}".format("No", "      Host Name", "IP", "State"))
	print("===========================================")
	dev_idx = 0
	online_count = 0

	if dev_list:
		for dev_info in dev_list:
			#calculate the count of each state
			dev_idx += 1
			if dev_idx > 2 and dev_info[2] == 'online':
				online_count += 1

			if disp_mode == 'all' or dev_info[2] == disp_mode:
				display_dev_info(dev_idx, dev_info)

		#display count
		total_count = dev_idx - 2
		print("\n\nTotal devices: {}".format(total_count))
		if disp_mode == 'all' or disp_mode == 'online':
			print("Online devices: {}".format(online_count))
		if disp_mode == 'all' or disp_mode == 'offline':
			print("Offline devices: {}".format(total_count - online_count))
	else:
		print("Not connected to internet")
#display menu and process the command
def go_to_menu():

	while True :
		print('====Menu====')
		print('Q  - Quit')
		print('SC - Scan the network and availability')
		print('LF - List all offline devices')
		print('LN - List all Online devices')
		print('CI - Check Internet (WAN) Connection')
		try:
			action = input("Enter an option to continue -> ")
			print("")
			if action.upper() == 'Q':
				break
			elif action.upper() == 'SC':
				print("Scanning the whole network.... \n")
				dev_list = scan_network()
				display_def_list(dev_list,'all')
			elif action.upper() == 'LF':
				print("Offline devices..\n")
				dev_list = scan_network()
				display_def_list(dev_list,'offline')
			elif action.upper() == 'LN':
				print("Online devices..\n")
				dev_list = scan_network()
				display_def_list(dev_list, 'online')

			elif action.upper() == 'CI':
				check_internet()
			else:
				raise Exception("Sorry, Option Error")
		except Exception:
			print("Input Option Correctly")
		print("")

#from netdiscover import *
#import nmap
if __name__ == "__main__":
    
    #nm = nmap.PortScanner()
    #res = nm.scan(hosts='192.168.105.1', arguments='-n -sP -PE -PA21,23,80,3389')
    #res = nm.scan(hosts='192.168.105.1',  arguments='-sn')
    #print(res)

    #disc = Discover();
    #res = disc.scan(ip_range="192.168.105.0/24")
    #print(res)

	go_to_menu()