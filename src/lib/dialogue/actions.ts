import { z } from "zod";
import { confirmationAnswer } from "./confirmation";

export const dialogueActionSchema = z.enum([
  "search", "choose_cheapest", "clarify", "new_task", "refine", "correct", "repeat", "repeat_price",
  "redisplay", "explain", "rephrase", "compare", "recommend", "select", "back", "answer", "help",
  "prepare", "approve", "cancel", "reject", "order_status", "stop", "stop_speech", "pause", "mute", "greeting", "advice", "pause_task", "end_task", "clarification_answer",
  "change_language", "summarize", "suggest_complement", "customize_item", "ask_reviews", "simplify", "elaborate", "translate",
]);
export type DialogueAction = z.infer<typeof dialogueActionSchema>;
export const offerReferenceSchema = z.enum(["first", "second", "third", "selected", "other", "cheapest", "fastest"]);

export function exitAction(text: string): "stop" | "end_task" | undefined {
  const value = text.normalize("NFKC").trim().replace(/[.!?।]+$/u, "").replace(/^(?:okay|ok|actually|please)[, ]+/iu, "").replace(/,? please$/iu, "");
  if (/^(?:stop listening|(?:(?:can|could) we |let['’]s )?(?:end|stop|close|exit) (?:the |this |our )?(?:conversation|session|chat)|goodbye|bye|बातचीत बंद करो|ఈ సంభాషణను ముగించు)$/iu.test(value)) return "stop";
  if (/^(?:(?:forget|drop|end|cancel|stop) (?:the |this |current |my )?(?:task|search|request)|cancel|cancel (?:this|that)|forget that|let['’]s (?:start over|talk about something else)|start over|never mind|nevermind|chhor do|chhod do|bhool jao|छोड़ दो|भूल जाओ|వదిలేయ్)$/iu.test(value)) return "end_task";
}

export function directAction(text: string): {
  action: DialogueAction;
  reference?: z.infer<typeof offerReferenceSchema>;
  language?: "en-IN" | "hi-IN" | "te-IN" | "hi-en";
  seller?: string;
  modifierId?: string;
} | undefined {
  const value = text.normalize("NFKC").trim().replace(/[.!?।]+$/u, "");
  if (/^(?:hello|hi|hey|namaste|नमस्ते|నమస్కారం|హలో|హాయ్)$/iu.test(value)) return { action: "greeting" };
  if (/^(?:where is my order|order status|track (?:my|the) order|मेरा ऑर्डर कहाँ है|ऑर्डर स्टेटस|నా ఆర్డర్ ఎక్కడ ఉంది)$/iu.test(value)) return { action: "order_status" };
  const exit = exitAction(value);
  if (exit) return { action: exit };
  if (/^(?:wait|hold on|stop (?:talking|speaking))$/iu.test(value)) return { action: "stop_speech" };
  if (/^(?:pause|set aside) (?:the |this )?(?:task|search)$/iu.test(value)) return { action: "pause_task" };
  if (/^(?:wait,? )?(?:please )?(?:repeat|say) (?:the |that )?(?:price|total|amount)(?: again)?$/iu.test(value) ||
      /^(?:price (?:dobara|phir se|mallī) (?:bolo|batana|cheppu)|रकम फिर से बोलो)$/iu.test(value)) return { action: "repeat_price" };
  if (/^(?:can you |please )?(?:repeat that|repeat what you (?:just )?said|repeat please|say that again|say again|pardon(?: me)?|kya bola|dobara bolo|फिर से बोलो|మళ్ళీ చెప్పు)$/iu.test(value)) return { action: "repeat" };
  if (/^(?:now )?(?:show (?:me )?(?:those|the|it|same)?\s*(?:options|offers)?\s*again|repeat the options|options phir se dikhao|wahi biryani dobara dikhao|वही बिरयानी दोबारा दिखाओ|ఆప్షన్లు మళ్ళీ చూపించు)$/iu.test(value)) return { action: "redisplay" };
  if (/^(?:go back|show (?:me )?the previous options|peeche jao|पीछे जाओ|వెనక్కి వెళ్ళు)$/iu.test(value)) return { action: "back" };
  if (/^(?:i didn['’]t understand|say it more simply|explain that more simply|aasan bhasha mein batao)$/iu.test(value)) return { action: "simplify" };
  if (/^(?:elaborate|tell me more|explain in more detail)$/iu.test(value)) return { action: "elaborate" };
  const translation = value.match(/^(?:translate that|say that) in (English|Hindi|Telugu|Hinglish)$/iu)?.[1].toLowerCase();
  if (translation) return { action: "translate", language: ({ english: "en-IN", hindi: "hi-IN", telugu: "te-IN", hinglish: "hi-en" } as const)[translation as "english"] };

  if (/^(?:speak telugu|talk in telugu|switch to telugu|telugu please|telugu mein bolo|telugulo matladu|తెలుగులో మాట్లాడు|తెలుగు మాట్లాడండి|మాట్లాడు తెలుగులో)$/iu.test(value)) {
    return { action: "change_language", language: "te-IN" };
  }
  if (/^(?:speak english|talk in english|switch to english|english please|english mein bolo|अंग्रेज़ी में बोलो|ఇంగ్లీష్ లో మాట్లాడు)$/iu.test(value)) {
    return { action: "change_language", language: "en-IN" };
  }
  if (/^(?:speak hindi|talk in hindi|switch to hindi|hindi please|हिंदी में बोलो|हिंदी में बात करो)$/iu.test(value)) {
    return { action: "change_language", language: "hi-IN" };
  }
  if (/^(?:speak hinglish|hinglish please|hinglish mein bolo|switch to hinglish)$/iu.test(value)) {
    return { action: "change_language", language: "hi-en" };
  }

  if (/^(?:what do people like about this|are there any complaints|why does this have a better rating|what are the reviews|show reviews|customer reviews|reviews kya hain|రివ్యూలు ఏమిటి|రివ్యూలు ఎలా ఉన్నాయి)$/iu.test(value)) {
    return { action: "ask_reviews" };
  }

  if (/^(?:what would make this better|what goes well with it|what else would you suggest|would a drink go with this|can i add toppings|can mirchi moon add (?:cheese|toppings)|does mirchi moon (?:support|have) toppings|what toppings are available|options for toppings|టాపింగ్స్ ఉన్నాయా)$/iu.test(value)) {
    return { action: "suggest_complement" };
  }

  const modMatch = value.match(/^(?:(?:yes,? )?(?:add|include|put)|కలపండి|వేయి)\s+(extra cheese|cheese|chocolate drizzle|choco chips|vanilla ice cream(?: scoop)?|ice cream|చీజ్)$/iu);
  if (modMatch) {
    const raw = modMatch[1].toLowerCase();
    const modId = raw.includes("cheese") || raw.includes("చీజ్") ? "cheese" : raw.includes("ice cream") ? "ice_cream" : "choco_chips";
    return { action: "customize_item", modifierId: modId };
  }

  const from = value.match(/^(?:(?:i['’]ll take|choose|pick|select) )?(?:the )?(?:one|option) from (.{2,80})$/iu);
  if (from) return { action: "select", seller: from[1] };
  if (/^(?:(?:choose|pick|select|i['’]ll take) )?(?:the )?(?:faster|fastest) (?:one|option)$/iu.test(value)) return { action: "select", reference: "fastest" };

  const sellerMatch = value.match(/^(?:(?:i (?:like|prefer)|i['’]ll take (?:the one from )?|show (?:me )?(?:the )?|(?:choose|select) )?)(mirchi moon|paper kite market|copper lane shop|sunday parcel)(?: option)?(?: again)?$/iu);
  if (sellerMatch) {
    return { action: "select", seller: sellerMatch[1] };
  }

  if (/^(?:why did you recommend that one|why that one|why is the (?:other|first|second|third) one (?:more expensive|better|cheaper|faster|recommended)|why the (?:other|first|second|third) one)$/iu.test(value) ||
      /^(?:(?:tell me )?why (?:is )?(?:the )?(other|first|second|third|pehla|doosra|teesra)(?: one| option)? (?:better|cheaper|more expensive|faster|recommended)(?: than (?:the )?(?:other|first|second|third)(?: one| option)?)?)$/iu.test(value) ||
      /^(?:(?:पहला|दूसरा|तीसरा|दूसरा वाला|पहला वाला) (?:क्यों|क्यूं) (?:बेहतर|सस्ता|महंगा|अच्छा) है\??|(?:first|second|third|doosra|pehla|teesra) (?:wala|option) kyu (?:better|sasta|achha|expensive) hai\??)$/iu.test(value)) {
    const rawRef = value.match(/(?:the |why |is )?(other|first|second|third|pehla|doosra|teesra|पहला|दूसरा|तीसरा|మొదటి|రెండవ|మూడవ)/iu)?.[1].toLowerCase();
    const refMap: Record<string, z.infer<typeof offerReferenceSchema>> = {
      other: "other", first: "first", pehla: "first", पहला: "first", మొదటి: "first",
      second: "second", doosra: "second", दूसरा: "second", రెండవ: "second",
      third: "third", teesra: "third", तीसरा: "third", మూడవ: "third",
    };
    const reference = rawRef ? refMap[rawRef] : undefined;
    return { action: "explain", reference: reference ?? offerReferenceSchema.safeParse(rawRef).data };
  }
  if (/^(?:what can you do|what do you do|how does this work|who are you|what is jugaad(?: one)?|kya kar sakte ho|tum kya kar sakte ho|तुम क्या कर सकते हो|నువ్వు ఏమి చేయగలవు|నువ్వేం చేయగలవు|నువ్వేం చేస్తావు|సహాయం|help|features)$/iu.test(value)) return { action: "help" };
  if (/^(?:summari[sz]e|recap) (?:the |these )?(?:three |all )?(?:options|offers)$/iu.test(value)) return { action: "summarize" };
  if (/^(?:compare (?:these|those|the) (?:offers|options)|what(?:'s| is) the difference between these(?: two)?|dono mein kya farak hai|వీటి మధ్య తేడా ఏమిటి)$/iu.test(value)) return { action: "compare" };
  if (/^(?:anything cheaper|show me the cheaper one|(?:choose|pick|select) the cheapest(?: one| option)?)$/iu.test(value)) return { action: "select", reference: "cheapest" };
  if (/^(?:(?:i['’]ll take|choose|pick|select) )?(?:that one|same one)$/iu.test(value)) return { action: "select", reference: "selected" };
  if (/^(?:(?:i['’]ll take|choose|pick|select) )?(?:the )?other one$/iu.test(value)) return { action: "select", reference: "other" };
  const ordinal = value.match(/^(?:(?:i['’]ll (?:take|choose|pick|select)|choose|pick|select|show me|चुनो|తీసుకో) )?(?:the |option |number )?(first|second|third|1st|2nd|3rd|1|2|3|पहला|दूसरा|तीसरा|మొదటి|రెండవ|మూడవ)(?: (?:one|option|wala|वाला|विकल्प|ఎంపిక))?$/iu)?.[1].toLowerCase();
  if (ordinal) {
    const groups = [
      ["first", "1st", "1", "पहला", "మొదటి"],
      ["second", "2nd", "2", "दूसरा", "రెండవ"],
      ["third", "3rd", "3", "तीसरा", "మూడవ"],
    ];
    const groupIdx = groups.findIndex((group) => group.includes(ordinal));
    if (groupIdx !== -1) {
      return { action: "select", reference: (["first", "second", "third"] as const)[groupIdx] };
    }
  }
  if (/^(?:great,? )?(?:proceed(?: with checkout)?|i['’]ll take it|prepare (?:the )?checkout)$/iu.test(value)) return { action: "prepare" };
  if (/^(?:yes,? )?(?:i )?approve (?:this|that|the) (?:amount|total)$/iu.test(value) ||
      confirmationAnswer(value) === "yes") return { action: "approve" };
  if (/^(?:(?:please )?cancel (?:the |this |my )?(?:pending )?(?:quote|checkout))$/iu.test(value)) return { action: "cancel" };
  if (/^(?:reject (?:the |this )?quote|no,? (?:don['’]t|do not) proceed)$/iu.test(value)) return { action: "reject" };
  if (/^(?:pause (?:the )?mic(?:rophone)?|pause listening)$/iu.test(value)) return { action: "pause" };
  if (/^(?:mute|mute (?:the )?(?:audio|voice))$/iu.test(value)) return { action: "mute" };
}
