# Workflow: handling rejection

One of the trickiest parts was finding the easiest experience for the patient. A doctor can refuse an appointment, or take a long time to answer.

To handle this, we first thought about asking the patient for a backup doctor from the start, in case the first one refuses. But we already ask the patient many things, and we wanted to ask as little as possible. So we chose a simpler way: we ask for only one doctor, and if that doctor refuses, we call the patient back.

But we will test more and we might change the approach again if we found it to be better.

# Pricing

We wanted to show prices, because price matters a lot when someone chooses a doctor.

If it were just the price of the appointment, it would be easy. But the real price depends on many things. Two doctors can have the same first consultation price and very different prices for their services.

We thought about letting doctors enter the price of each service. That works for services with a fairly fixed price, like braces. But in most cases, patients don't know what they need. They need the doctor to diagnose them first, and that is not something an AI can discuss over the phone. So we decided not to show full prices.

# Geocoding

To find the patient's location, we use Geoapify. It had the richest data of all the services we tried. But it is still not perfect, and some addresses exist in several places.

Because of this, we also have to help the AI with Tunisian cities and places, so it understands what callers say.

# Testing the call models

The phone call is the most important feature in the app, so it has to be as good as possible. We tested many models and many approaches to find the best one.

## Two ways to build a phone call

There are two different ways to build a phone call with AI.

- **Speech to speech (realtime).** One model listens to the caller and answers with its own voice. It is fast and feels natural.
- **A chain of steps.** Three steps run one after another: the caller's voice becomes text, an AI model writes the answer, and the answer becomes voice again. This gives more control, because we can choose the best model for each step. But every step adds waiting time.

We tried both.

## How we tested

We tested the models ourselves with a small program that acts like a phone caller. It plays the same 7 sentences each time: Tunisian Arabic, French, and mixed ones like "نحب ناخذ rendez-vous عند dermatologue". It records what the AI answers and how long it takes. We used the real app instructions and booking tools, so the AI behaved as it would in production. We also timed each step on its own, to see which one was slow. To compare fairly, we also built a test call page where we can switch between engines and run the same call on each one.

One limit to be honest about: the test voices were computer voices, not real patients.

## The real challenge: Tunisian Arabic

For English and French, almost every speech-to-text and voice model we tried worked well. Tunisian Arabic (Derja) was where the models differed, and it was the problem from the start.

- **Few models understand it.** One model returned nothing for Arabic. Others dropped words or spelled them wrongly. Mixed sentences, with French words inside Arabic, were the hardest.
- **Few voices speak it well.** Gemini had the most natural Arabic voices. Inworld has only two Arabic voices, and they were not perfect.
- **We judged every choice on Tunisian Arabic first,** because that is how our patients speak.

## Approach 1: realtime models (speech to speech)

We started with Azure OpenAI realtime, and then tested Gemini Live to compare.

- **GPT realtime** had a very good response time and followed our instructions well. Its problem was that the pronunciation was not perfect. We could have stayed with it, but we wanted to try more models and more approaches, to be sure which one is really better.
- **Gemini Live** (gemini-3.8-live and gemini-3.8-live-extended-thinking) also had a very good response time, and it had the best voice. Its problem was that it could not follow our instructions carefully, and it lost track of the conversation. The "extended thinking" version often failed to use the results of our booking tools (8 of 18 tries in our test).

On response time, both were fast. In our test, Gemini Live answered in 1.6 to 4.5 seconds: faster when it answered right away, slower when it first called a tool.

## Approach 2: speech to text, then an AI model, then text to speech

Next we tried the chain of steps, first with Inworld.ai. The AI models we could use there were not great. It also answered in about 2.2 seconds in our test call. And Inworld only has two Arabic voices, which were not perfect.

## Approach 3: LiveKit agents with different models

After that, we used LiveKit agents. They let us choose the model for every step, so we could test many combinations. All the comparison tables below come from these tests. We mainly used Inworld only as a speech-to-text and text-to-speech provider. Its speech-to-text was not good in Arabic, and its voice was not perfect either.

We did not find a good combination of a good model and a fast response time.

| Step | Model | What we found | Problem |
|---|---|---|---|
| Listening | Microsoft MAI | Best on our sentences, about 0.5 s | A preview product, one provider only |
| Listening | Gemini | Excellent text | 2 to 3 s per sentence |
| Listening | Inworld | Fast | Not good in Arabic, worst on mixed sentences |
| Thinking | GPT-5.4 mini | Fast, about 1.2 s to start | Less smart than Claude |
| Thinking | Claude Sonnet | The smartest | 3 times slower to start (3.6 s) |
| Voice | Gemini | The most natural | 2 to 3 s before it starts talking |
| Voice | Inworld | Fast | Only 2 Arabic voices, not perfect |

The best models were often the slowest ones, and the fast ones were not good enough. The fastest chain we built still waited about 6.8 seconds before answering. With Gemini for listening and for the voice, it was more than 10 seconds.

What we learned from the tests:

- **The best models were often the slowest.** The best voice and the best listening model were also the slowest ones.
- **Speed adds up.** Each step in the chain adds its own waiting time.
- **Testing found real bugs.** The AI saved the caller's name or language on almost every turn, which cost about 1 extra second each time. We moved it to a background job.

# Waiting time and our final choice

On a phone call, the wait between the caller finishing and the AI answering is very important. If the wait is long, the call feels strange. So we paid close attention to speed.

GPT realtime and Gemini Live both had very good response times. The Inworld setup was slower, at about 2.2 seconds, and the chains we built with LiveKit agents were slower still, at 6.8 seconds or more.

In the end, we decided to stick with OpenAI realtime, directly from the OpenAI API, because it gave the best experience overall: fast answers and a smarter AI.
