import os
import json
import time
import random
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
    "This contract passed audit.\nOwner can still drain funds.\n\nPeople don't read permissions.\n\nWhat are you actually trusting?",
    "Agents will manage millions.\nMost contracts they use are unsafe.\n\nNo one is talking about this.\n\nWho secures the agents?",
    "Same wallet cluster.\nSame launch pattern.\nSame exit.\n\nYou've seen this before.\n\nWhy do people still fall for it?",
    "I scanned 50 contracts today.\n34 had owner-drain functions.\n\nAll of them had audits.\n\nWhat does that tell you?",
    "Everyone is bullish.\nNo one checked permissions.\n\nThe next rug won't surprise me.\n\nWill it surprise you?",
    "Another rug. Same pattern.\nYou're still missing it.\n\nStop trusting logos.\nStart reading contracts.",
    "People trust audits.\nAttackers read them too.\n\nSecurity isn't a badge.\nIt's a process.",
    "This contract looks safe.\nIt's not.\n\nOne function call and liquidity is gone.\n\nDid your audit catch that?",
    "Most audited contracts can still drain you.\n\nThe audit checked the code.\nNot the permissions.\n\nThere's a difference.",
    "3 things to check before buying any token.\n\nOwner privileges.\nLP lock status.\nWallet clusters.\n\nSkip one and you're exit liquidity.",
    "Contract deployed 2h ago.\nOwner can drain liquidity.\nAudit said safe.\n\nReal-time beats static.\n\nAlways.",
    "You check the chart.\nYou check the socials.\nYou skip the contract.\n\nThat's exactly what they count on.",
    "Audits are snapshots.\nExploits are real-time.\n\nThe gap between them is where money disappears.\n\n$APOL watches the gap.",
    "The forensic layer of Base isn't optional.\nIt's inevitable.\n\nThe only question is who builds it first.",
    "AI agents are trading onchain right now.\nNo security layer. No permissions check.\n\nWhat could go wrong?",
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
