# XO feedback

*Written by Fluid (@levithefirst), dictated and lightly cleaned up for filler words only.*

I think the idea of XO is a very good one. It's an app that allows one transaction to be sent to several people, and each of those people can add their parts and their signatures. So yes, it fits the savings circle I was trying to build very well. That's the really positive thing I have about XO.

The setup was very, very complex, because I used one of the newest Python versions, so I had to find a workaround. That was not a pleasant experience at all.

Also, the way of connecting is very hard. It only connects to the network in one way, so I had to build a bridge to get around it.

A lot of error messages kept popping up. "Stack size not valid" was the one that annoyed me the most, because the issue wasn't that at all: I had not signed anything yet. It also brought out another error message, "merged input undefined", and the main issue was just that it needed to know which part to sign.

Another issue is that the engine can't see the wallet's coins, so I had to add an extra step to make that possible.

P2SH was a big problem too, because it was wrapping the contract twice. On my first attempt it locked the coins the wrong way. I think something about that should be put in the docs, or at least a warning, so we don't have to go through all that stress.

Because it took a long while and I was doing a lot of things in between while building this, every failed try just kept the coins in reserve until I cleared them manually.

The fee estimate was way off. It estimated around 960 sats, but it actually used 1,600.

The site was very clunky. You have to create an account before it shows you anything, and I can't link what I'm doing straight to a transaction. I had to find a workaround for that too.

But at the end of the day, I made it work. The contribution went through XO and it was marked valid. That's about it.
