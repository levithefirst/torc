# XO feedback (levithefirst, own words)

I think the idea behind XO is a very good one. One transaction can go out to several people, and each of them adds their part and their signature. That fits the savings circle I was building very well, and it's the most positive thing I have to say about XO. In the end I made it work: Torc's contribution went through the XO engine and the inspector marked it valid.

The setup was very complex. I was on one of the newest Python versions and had to find a workaround, which was not a pleasant experience. Connecting was also hard. The engine only reaches the network one way, so I had to build a bridge to get around it.

The error messages cost me the most time. "Stack size not valid" annoyed me most, because I hadn't even signed anything yet. Another was "merge input undefined", when the real issue was that it needed to know which input to sign. The engine also can't see the wallet's coins, so I had to add an extra step for that.

P2SH was a big problem. The contract got wrapped twice, so my first attempt locked the coins the wrong way. The docs should cover this, or at least warn about it. Every failed try also kept the coins reserved until I cleared them by hand. The fee estimate was way off, about 960 sats estimated against roughly 1,600 sats actually used. The site is clunky too. It makes you create an account before it shows you anything, and I couldn't link what I was doing straight to a transaction without a workaround.

What I'd fix, most important first:
1. Accurate error messages. That alone would have saved me hours.
2. Signing. Right now I have to sign each input separately, or it crashes with "input undefined" or "merge input undefined".
3. Watching your own wallet. It should track the wallet's address and see its own coins automatically.
4. A P2SH warning. The naming is confusing, so warn when a script is already wrapped, so nobody locks coins the wrong way.
5. Releasing coins automatically after a failed send, a bad broadcast or a timeout.
6. More ways to connect, such as a proper HTTPS connection to the network, so no bridge is needed.
7. Shareable links. I should be able to open a transaction directly by its txid in the URL.

Thanks.
