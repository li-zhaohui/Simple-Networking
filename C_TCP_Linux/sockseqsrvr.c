#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <errno.h>

#define NON_RESERVED_PORT    5001
#define BUFFER_LEN           1024
#define SERVER_ACK           "ACK_FROM_SERVER\n"

/* extern char *sys_errlist[]; */

void server(void);
int setup_to_accept(int por);
int accept_connection(int accept_socket);
void serve_one_connection(int client_socket);
void client(char *server_host);
int connect_to_server(char *hostname, int port);
void send_msg(int fd, char *buf, int size);
int recv_msg(int fd, char *buf);
void error_check(int val, const char *str);

void main(int argc,char *argv[])
{
    /* second argument, if supplied, is host where server is running */
    if (argc == 2)
    {
        printf("calling client\n");
        client(argv[1]);
        printf("back from client\n");
    }
    else  /* if no arguments then running as the server */
    {
        printf("calling server\n");
        server();
        printf("back from server\n");
    }
}

void server()
{
    int rc, accept_socket, client_socket;

    accept_socket = setup_to_accept(NON_RESERVED_PORT);
    for (;;)
    {
        client_socket = accept_connection(accept_socket);
        serve_one_connection(client_socket);
    }
}

void serve_one_connection(int client_socket)
{
    int rc, ack_length;
    char buf[BUFFER_LEN];

    ack_length = strlen(SERVER_ACK)+1;
    rc = recv_msg(client_socket, buf);
    buf[rc] = '\0';
    while (rc != 0)
    {
        printf("server received %d bytes  :%s: \n",rc,buf);
        send_msg(client_socket, (char *)SERVER_ACK, ack_length);
        rc = recv_msg(client_socket, buf);
        buf[rc] = '\0';
    }
    close(client_socket);
}

void client(char *server_host)
{
    int rc, client_socket;
    char buf[BUFFER_LEN];

    client_socket = connect_to_server(server_host,NON_RESERVED_PORT);
    printf("\nEnter a line of text to send to the server or EOF to exit\n");
    while (fgets(buf,BUFFER_LEN,stdin) != NULL)
    {
        send_msg(client_socket, buf, strlen(buf)+1);
        rc = recv_msg(client_socket, buf);
        buf[rc] = '\0';
        printf("client received %d bytes  :%s: \n",rc,buf);
        printf("\nEnter a line of text to send to the server or EOF to exit\n");
    }
}

int setup_to_accept(int port)
{
    int rc, accept_socket;
    int optval = 1;
    struct sockaddr_in sin;

    sin.sin_family = AF_INET;
    sin.sin_addr.s_addr = INADDR_ANY;
    sin.sin_port = htons(port);

    accept_socket = socket(AF_INET, SOCK_STREAM, 0);
    error_check(accept_socket, "setup_to_accept socket");

    setsockopt(accept_socket,SOL_SOCKET,SO_REUSEADDR,(char *)&optval,sizeof(optval));

    rc = bind(accept_socket, (struct sockaddr *)&sin ,sizeof(sin));
    error_check(rc, "setup_to_accept bind");

    rc = listen(accept_socket, 5);
    error_check(rc, "setup_to_accept listen");

    return(accept_socket);
}

int accept_connection(int accept_socket)
{
    struct sockaddr_in from;
    int fromlen, client_socket, gotit;
    int optval = 1;

    fromlen = sizeof(from);
    gotit = 0;
    while (!gotit)
    {
        client_socket = accept(accept_socket, (struct sockaddr *)&from,
                               (socklen_t *)&fromlen);
        if (client_socket == -1)
        {
            /* Did we get interrupted? If so, try again */
            if (errno == EINTR)
                continue;
            else
                error_check(client_socket, "accept_connection accept");
        }
        else
            gotit = 1;
    }
    setsockopt(client_socket,IPPROTO_TCP,TCP_NODELAY,(char *)&optval,sizeof(optval));
    return(client_socket);
}

int connect_to_server(char *hostname, int port)
{
    int client_socket;
    struct sockaddr_in listener;
    struct hostent *hp;
    int rc;
    int optval = 1;

    hp = gethostbyname(hostname);
    if (hp == NULL)
    {
        printf("connect_to_server: gethostbyname %s: %s -- exiting\n", hostname, strerror(errno));
        exit(-1);
    }

    bzero((void *)&listener, sizeof(listener));
    bcopy((void *)hp->h_addr, (void *)&listener.sin_addr, hp->h_length);
    listener.sin_family = hp->h_addrtype;
    listener.sin_port = htons(port);

    client_socket = socket(AF_INET, SOCK_STREAM, 0);
    error_check(client_socket, "net_connect_to_server socket");

    rc = connect(client_socket,(struct sockaddr *) &listener, sizeof(listener));
    error_check(rc, "net_connect_to_server connect");

    setsockopt(client_socket,IPPROTO_TCP,TCP_NODELAY,(char *)&optval,sizeof(optval));
    return(client_socket);
}

int recv_msg(int fd, char *buf)
{
    int bytes_read;

    bytes_read = read(fd, buf, BUFFER_LEN);
    error_check( bytes_read, "recv_msg read");
    return( bytes_read );
}

void send_msg(int fd, char *buf, int size)
{
    int n;

    n = write(fd, buf, size);
    error_check(n, "send_msg write");
}

void error_check(int val, const char *str)
{
    if (val < 0)
    {
        printf("%s :%d: %s\n", str, val, strerror(errno));
        exit(1);
    }
}
