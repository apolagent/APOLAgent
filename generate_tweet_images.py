from PIL import Image, ImageDraw, ImageFont
import textwrap
import os

MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

BG = (0, 0, 0)
GREEN = (0, 255, 0)
DIM_GREEN = (0, 180, 0)
DARK_GREEN = (0, 60, 0)
WHITE = (255, 255, 255)
RED = (255, 68, 68)

W, H = 1200, 675

LOGO_PATH = "public/apol-agent-logo.png"

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

os.makedirs("tweet_images", exist_ok=True)

logo = None
if os.path.exists(LOGO_PATH):
    logo = Image.open(LOGO_PATH).convert("RGBA").resize((48, 48), Image.LANCZOS)

for idx, tweet in enumerate(tweets):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    border_inset = 12
    draw.rectangle(
        [border_inset, border_inset, W - border_inset - 1, H - border_inset - 1],
        outline=DARK_GREEN, width=2
    )

    inner_inset = 20
    draw.rectangle(
        [inner_inset, inner_inset, W - inner_inset - 1, inner_inset + 40],
        fill=(0, 20, 0)
    )
    draw.line(
        [inner_inset, inner_inset + 40, W - inner_inset - 1, inner_inset + 40],
        fill=DARK_GREEN, width=1
    )

    title_font = ImageFont.truetype(MONO_BOLD, 14)
    header_text = "APOL AGENT // SECURITY BULLETIN"
    draw.text((inner_inset + 14, inner_inset + 12), header_text, fill=GREEN, font=title_font)

    status_text = f"[ALERT {idx + 1:03d}]"
    bbox = draw.textbbox((0, 0), status_text, font=title_font)
    sw = bbox[2] - bbox[0]
    draw.text((W - inner_inset - 14 - sw, inner_inset + 12), status_text, fill=RED, font=title_font)

    body_font = ImageFont.truetype(MONO_BOLD, 22)
    lines = tweet.split("\n")
    wrapped = []
    for line in lines:
        if line.strip() == "":
            wrapped.append("")
        else:
            wrapped.extend(textwrap.wrap(line, width=42))

    y = inner_inset + 60
    for line in wrapped:
        if line == "":
            y += 12
            continue
        draw.text((inner_inset + 30, y), line, fill=GREEN, font=body_font)
        y += 32

    footer_y = H - inner_inset - 50
    draw.line(
        [inner_inset, footer_y, W - inner_inset - 1, footer_y],
        fill=DARK_GREEN, width=1
    )

    footer_font = ImageFont.truetype(MONO, 13)

    if logo:
        img.paste(logo, (inner_inset + 14, footer_y + 8), logo)
        brand_x = inner_inset + 72
    else:
        brand_x = inner_inset + 14

    draw.text((brand_x, footer_y + 12), "APOL AGENT", fill=GREEN, font=ImageFont.truetype(MONO_BOLD, 16))
    draw.text((brand_x, footer_y + 32), "apolagent.online", fill=DIM_GREEN, font=footer_font)

    tag_text = "@Apol_Agent"
    bbox = draw.textbbox((0, 0), tag_text, font=footer_font)
    tw = bbox[2] - bbox[0]
    draw.text((W - inner_inset - 14 - tw, footer_y + 12), tag_text, fill=DIM_GREEN, font=footer_font)

    chain_text = "Built on Base"
    bbox = draw.textbbox((0, 0), chain_text, font=footer_font)
    cw = bbox[2] - bbox[0]
    draw.text((W - inner_inset - 14 - cw, footer_y + 32), chain_text, fill=DARK_GREEN, font=footer_font)

    for sx in range(0, W, 4):
        for sy in range(0, H, 4):
            if (sx + sy) % 80 == 0:
                draw.point((sx, sy), fill=(0, 30, 0))

    filepath = f"tweet_images/tweet_{idx:02d}.png"
    img.save(filepath, "PNG")
    print(f"Generated: {filepath}")

print(f"\nDone. {len(tweets)} images generated.")
