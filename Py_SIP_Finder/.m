my $file = 'results.txt';
open HOSTS, $file or die $!;
$i = 0;
while (<HOSTS>) { 
chomp $_;
my ($ip,$user,$pass) = split(/,/, $_);
print "
[ACCOUNT$i]
Server=$ip
User=$user
Password=$pass
STUN=
Proxy=
";
$i++
}
