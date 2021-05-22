build:
	rm -f fallos
	g++ -g -std=c++11 -Wall main.cpp -o fallos -lpthread
	
run:
	./fallos

valgrind:
	valgrind --tool=memcheck --leak-check=yes ./fallos
