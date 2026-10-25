from playwright.sync_api import sync_playwright

# Testing this by starting up python app.py in a separate terminal, then run python -m pytest tests/test_ui.py
def load_app(page):
    page.goto("http://127.0.0.1:5000")
    page.wait_for_timeout(2000)

def test_context_menu_opens():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        page.locator("#textDiv").click(button="right")
        assert page.locator("#contextMenu").is_visible()
        browser.close()

def test_context_menu_closes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        page.locator("#textDiv").click(button="right")
        assert page.locator("#contextMenu").is_visible()
        page.mouse.click(10, 10)
        assert not page.locator("#contextMenu").is_visible()
        browser.close()

def test_jump_input_exists():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        assert page.locator("#jumpInput").is_visible()
        assert page.locator("#jumpBtn").is_visible()
        browser.close()

def test_page_display_exists():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        assert page.locator("#pageDisplay").is_visible()
        browser.close()

def test_relevance_menu_items_exist():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        page.locator("#textDiv").click(button="right")
        assert page.locator("#menu-nextrelevant").is_visible()
        assert page.locator("#menu-prevrelevant").is_visible()
        browser.close()
        
def test_stepin_context_item_present():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        page.locator("#textDiv").click(button="right")
        assert page.locator("#menu-stepin").is_visible()
        assert page.locator("#menu-stepout").is_visible()
        assert page.locator("#menu-nextline").is_visible()
        assert page.locator("#menu-prevline").is_visible()
        browser.close()
        
def test_relevance_items_present():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        page.locator("#textDiv").click(button="right")
        assert page.locator("#menu-nextrelevant").is_visible()
        assert page.locator("#menu-prevrelevant").is_visible()
        browser.close()
        
def test_page_navigation_present():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        assert page.locator("#nextPage").is_visible()
        assert page.locator("#prevPage").is_visible()
        browser.close()

def test_line_navigation_present():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        assert page.locator("#NextLine").is_visible()
        assert page.locator("#prevLine").is_visible()
        browser.close()
        
def test_session_created():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        session = page.evaluate(
            "localStorage.getItem('LD-Session')"
        )
        assert session is not None
        browser.close()
        
def test_session_restore():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        page.fill("#jumpInput", "3")
        page.click("#jumpBtn")
        page.wait_for_timeout(1000)
        before = page.locator("#pageDisplay").text_content()
        page.reload()
        page.wait_for_timeout(2000)
        after = page.locator("#pageDisplay").text_content()
        assert before == after
        browser.close()
        
def test_step_in_out():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        lines = page.locator("#textDiv > *")
        lines.nth(0).click()
        before = page.locator("#file-dropdown").input_value()
        page.click("#NextLine")
        page.click("#stepIn")
        page.wait_for_timeout(3000)
        page.click("#stepOut")
        page.wait_for_timeout(1000)
        after = page.locator("#file-dropdown").input_value()
        assert before == after
        browser.close()
        
def test_context_menu():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        before = page.locator("#pageDisplay").text_content()
        page.wait_for_selector("#textDiv > *")
        page.locator("#textDiv").click(button="right")
        page.click("#menu-nextpage")
        page.wait_for_timeout(500)
        after = page.locator("#pageDisplay").text_content()
        assert before != after
        browser.close()
        
def test_next_page_changes_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        before = page.locator("#pageDisplay").text_content()
        page.click("#nextPage")
        page.wait_for_timeout(1000)
        after = page.locator("#pageDisplay").text_content()
        assert before != after
        browser.close()

def test_context_menu_next_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        load_app(page)
        before = page.locator("#pageDisplay").text_content()
        page.locator("#textDiv").click(button="right")
        page.click("#menu-nextpage")
        page.wait_for_timeout(1000)
        after = page.locator("#pageDisplay").text_content()
        assert before != after
        browser.close()