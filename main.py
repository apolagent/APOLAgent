import os
import tweepy
import requests
from requests.auth import HTTPProxyAuth

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

tweet_text = "APOL Agent: Autonomous state-logic stabilized. Location: Frankfurt, Germany. 🛡️"

try:
    response = client.create_tweet(text=tweet_text)
    tweet_id = response.data["id"]
    print(f"Tweet posted successfully! Tweet ID: {tweet_id}")
except Exception as e:
    print(f"Failed to post tweet: {e}")
