from requests_html import HTML
from requests_html import HTMLSession
import requests



link1 = 'https://ww.dr7seven.com/encrypt.js'
resp1 = requests.get(link1)

main_script = """
        function get_key()
        {
                return res.encrypt("M5500000000000004=2412:776");        
        }
        get_key();
"""
jscode = resp1.text + main_script

html = HTML(html="<a href='http://www.example.com/'>")

key = html.render(script = jscode, reload = False)
print(key)
