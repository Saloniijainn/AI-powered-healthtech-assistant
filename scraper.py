import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time
import json

BASE_URL = "https://welleazy.com"
visited = set()
collected_data = []

def is_valid_url(url):
    return url.startswith(BASE_URL) and 'tel:' not in url and 'mailto:' not in url

def extract_text(soup):
    for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'form']):
        tag.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return ' '.join(text.split())

def scrape_page(url):
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return
        soup = BeautifulSoup(response.content, 'html.parser')

        # ✅ Extract footer contact details
        footer = soup.find("footer")
        if footer:
            contact_text = footer.get_text(separator="\n", strip=True)
            collected_data.append({
                "url": url,
                "title": "Footer Contact Info",
                "content": contact_text
            })

        text = extract_text(soup)
        title = soup.title.string.strip() if soup.title else ''
        collected_data.append({
            'url': url,
            'title': title,
            'content': text
        })

        print(f"Scraped: {url}")
        time.sleep(1)
        for link in soup.find_all('a', href=True):
            full_url = urljoin(url, link['href']).split('#')[0]
            if is_valid_url(full_url) and full_url not in visited:
                visited.add(full_url)
                scrape_page(full_url)
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")

    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return
        soup = BeautifulSoup(response.content, 'html.parser')
        text = extract_text(soup)
        title = soup.title.string.strip() if soup.title else ''
        collected_data.append({
            'url': url,
            'title': title,
            'content': text
        })
        print(f"Scraped: {url}")
        time.sleep(1)
        for link in soup.find_all('a', href=True):
            full_url = urljoin(url, link['href']).split('#')[0]
            if is_valid_url(full_url) and full_url not in visited:
                visited.add(full_url)
                scrape_page(full_url)
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")

# Start
visited.add(BASE_URL)
scrape_page(BASE_URL)

# Save
with open("data/welleazy_scraped_data.json", "w", encoding='utf-8') as f:
    json.dump(collected_data, f, ensure_ascii=False, indent=2)

print(f"✅ Total pages scraped: {len(collected_data)}")