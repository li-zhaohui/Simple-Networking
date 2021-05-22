A balancer solution to Assignment #4. 


Executing order:
	server1
	server2
	server3
	server4
	...

	balancer

	client1
	client2
	client3
	...


server
------

To run the server, simple execute:

  python server.py

potentially substituting your installation of python3 in for python depending
on your distribution and configuration.  The server will report the port 
number that it is listening on for your client to use.  Place any files to 
transfer into the same directory as the server.

Note:Place test.jpg file more than 5MB to test load into the same directory as the server.


client
------

To run the client, execute:

  python client.py http://host:port/file

where host is where the server is running (e.g. localhost), port is the port 
number reported by the server where it is running and file is the name of the 
file you want to retrieve.  Again, you might need to substitute python3 in for
python depending on your installation and configuration.

Note:Type the host and port following the balancers port and host

balancer
------

To run the balancer, simple execute:

  python balancer.py

potentially substituting your installation of python3 in for python depending
on your distribution and configuration.  The balancer will report the port 
number that it is listening on for your client to use.  Place error reporting html files to 
transfer into the same directory as the balancer.

Note: You have to run many servers first before running the balancer
	And then update the server_list in the code folling the host and port of all servers



