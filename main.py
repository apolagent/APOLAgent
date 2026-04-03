import os
import json
import time
import random
import sys

PAUSED = False

import tweepy

LOCK_FILE = "/tmp/apol_last_tweet.json"
MIN_INTERVAL = 11 * 60 * 60

now = time.time()
if os.path.exists(LOCK_FILE):
    try:
        with open(LOCK_FILE, "r") as f:
            last = json.load(f).get("timestamp", 0)
        if now - last < MIN_INTERVAL:
            minutes_ago = int((now - last) / 60)
            print(f"Skipped — last tweet was {minutes_ago} minutes ago. Minimum interval is {MIN_INTERVAL // 3600}h.")
            exit(0)
    except Exception:
        pass

API_KEY = os.environ["API_KEY"]
API_SECRET = os.environ["API_SECRET"]
ACCESS_TOKEN = os.environ["ACCESS_TOKEN"]
ACCESS_SECRET = os.environ["ACCESS_SECRET"]

PROXY_IP = os.environ["PROXY_IP"]
PROXY_PORT = os.environ["PROXY_PORT"]
PROXY_USER = os.environ["PROXY_USER"]
PROXY_PASS = os.environ["PROXY_PASS"]

proxy_url = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_IP}:{PROXY_PORT}"
os.environ["HTTP_PROXY"] = proxy_url
os.environ["HTTPS_PROXY"] = proxy_url

client = tweepy.Client(
    consumer_key=API_KEY,
    consumer_secret=API_SECRET,
    access_token=ACCESS_TOKEN,
    access_token_secret=ACCESS_SECRET,
)

tweets = [
    'Contract audited? Good for you. Now go check the hidden owner permissions in the implementation contract. Most don\'t.',
    'Standard security tools are built to catch common errors. APOL is built to catch the anomalies they ignore.',
    'The most dangerous functions are often the ones labeled "Emergency." Always verify who holds the key.',
    'Transparency is a choice. Onchain data is an undeniable fact. We prefer the latter.',
    'A "Passed Audit" badge is not a shield. It is often just a distraction from the liquidity exit strategy.',
    'High yield is usually just a premium paid for unquantified risk. APOL quantifies the unquantifiable.',
    'The blockchain never forgets, but it\'s very good at hiding. Forensic intelligence brings the hidden to light.',
    'Scanning the surface is for traders. Deep-diving the bytecode is for professionals. Which one are you?',
    'Your favorite protocol just deployed a new proxy. Did you verify the logic change, or did you just trust the tweet?',
    'Smart contracts are only as "smart" as the human who didn\'t leave a backdoor. We find the backdoors.',
    'In a world of hyped launches, Active Onchain Intelligence is the only real signal. Everything else is noise.',
    'Rugpulls don\'t happen by accident. They are coded in plain sight. You just need the right eyes to see them.',
    'Technical debt in a smart contract is just a future exploit waiting for a timestamp. Monitor the debt.',
    'Most "exploits" are actually just features the users didn\'t bother to read in the documentation. We read everything.',
    'Security isn\'t a state you achieve; it\'s a constant process of onchain verification. APOL never stops.',
]

tweet_text = random.choice(tweets)

try:
    response = client.create_tweet(text=tweet_text)
    tweet_id = response.data["id"]
    with open(LOCK_FILE, "w") as f:
        json.dump({"timestamp": now, "tweet_id": tweet_id}, f)
    print(f"Tweet posted successfully! Tweet ID: {tweet_id}")
    print(f"URL: https://x.com/Apol_Agent/status/{tweet_id}")
    print(f"\nPosted:\n{tweet_text}")
except Exception as e:
    print(f"Failed to post tweet: {e}")
