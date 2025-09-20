import json
from sys import argv

from pywikibot import Site, config, Page


def dump_json(o) -> str:
    return json.dumps(o, indent=4)

def main():
    if len(argv) != 6:
        print(f"Expect python {argv[0]} <commit hash> <consumer_token> <consumer_secret> <access_token> <access_secret>")
        print(f"Got {len(argv)} arguments intead")
        return
    authenticate = tuple(argv[2:])
    config.authenticate['dev.miraheze.org'] = authenticate
    s = Site()
    s.login()
    hash_value = argv[1]
    p = Page(s, "User:PetraMagnaBot/version.json")
    p.text = dump_json({"hash": hash_value})
    p.save(summary="update commit hash")

if __name__ == "__main__":
    main()