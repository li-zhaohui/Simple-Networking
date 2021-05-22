from selenium  import webdriver  
from webdriver_manager.chrome import ChromeDriverManager
import time  
from selenium.webdriver.common.keys import Keys  
print("test case started")  
#open Google Chrome browser  
driver = webdriver.Chrome(ChromeDriverManager().install())

#maximize the window size  
driver.maximize_window()  
#delete the cookies  
driver.delete_all_cookies()  
#navigate to the url  
driver.get("https://www.google.com/")  
#identify the user name text box and enter the value  
driver.find_element_by_id("identifierId").send_keys("xyz11@gmail.com")  
time.sleep(2)  
#click on the next button  
driver.find_element_by_xpath("//span[@class='RveJvd snByac'][1]").click()  
time.sleep(3)  
#identify the password text box and enter the value   
driver.find_element_by_name("password").send_keys("#########")  
time.sleep(3)  
#click on the next button  
driver.find_element_by_xpath("//span[contains(text(),'Next')][1]").click()  
time.sleep(3)  
#close the browser  
driver.close()  
print("Gmail login has been successfully completed")  