from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Catch console messages
    def log_msg(msg):
        print(f"CONSOLE: [{msg.type}] {msg.text}")
    page.on("console", log_msg)
    
    # Catch unhandled errors
    def log_err(err):
        print(f"JS ERROR: {err}")
    page.on("pageerror", log_err)
    
    print("Navigating to login...")
    page.goto('http://localhost:4200/login', wait_until='networkidle')
    page.fill('input[type="text"]', 'admin')
    page.fill('input[type="password"]', 'admin123')
    page.click('button[type="submit"]')
    page.wait_for_url('http://localhost:4200/dashboard', wait_until='networkidle')
    
    print("Navigating to items...")
    page.goto('http://localhost:4200/inventory/items', wait_until='networkidle')
    
    print("Waiting for data table row...")
    # Find the first table row inside tbody
    page.wait_for_selector('tbody tr', timeout=5000)
    
    print("Clicking first row...")
    page.click('tbody tr:first-child')
    
    # Wait for a bit to see if network fires or error happens
    page.wait_for_timeout(3000)
    
    print("Script finished.")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
