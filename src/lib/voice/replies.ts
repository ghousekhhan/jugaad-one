import type { VoiceLocale } from "./types";

const english = {
  unsupported: "I can help you find a dish and compare food quotes from Wiggy and Tomato.",
  dish: (restaurant?: string) => restaurant ? `Which dish would you like me to price from ${restaurant}?` : "What dish would you like to find?",
  clarify: "Which dish, location, or preference should I use for this search?",
  location: (unknown: boolean): string => unknown ? "I couldn’t match that location to the marketplace. Which supported city or neighborhood should I use?" : "Which city or neighborhood should I search?",
  allergen: "The fictional catalog can check dairy, egg, gluten, nuts, peanuts and sesame. Which supported allergen should I use?",
  provider: (limited: boolean): string => limited ? "The marketplace is limiting requests. Your constraints are saved for this conversation. Try again in a minute." : "I couldn’t verify the marketplace response. Your constraints are saved for this conversation. Try again to check live offers.",
  incomplete: (count: number, more: boolean, providers: string, choose: boolean) => `${count ? `I verified ${count} eligible ${count === 1 ? "quote" : "quotes"}. ` : ""}${more ? "There are additional candidates beyond this comparison." : `I couldn’t finish checking ${providers}.`} ${choose ? "I can’t establish the cheapest eligible offer yet." : "You can narrow the search or try again."}`,
  noMatch: (dish: string, location: string) => `No eligible quotes matched your constraints for ${dish} near ${location}. Which constraint would you like to change?`,
  results: (count: number, dish: string, location: string) => `I found ${count} eligible ${count === 1 ? "quote" : "quotes"} for ${dish} near ${location}. The totals include provider fees and tax.`,
  selected: (dish: string, restaurant: string, provider: string, total: string) => `The cheapest eligible quote is ${dish} from ${restaurant} on ${provider} at ${total}, including fees and tax. I’ve selected it for your review.`,
  approval: (provider: string, total: string) => `${provider} quoted a total of ${total}, including fees and tax. Would you like to approve this amount for simulated checkout?`,
  confirmation: (provider: string, reference: string) => `${provider} confirmed your simulated order. Your reference is ${reference}. No money was charged.`,
};

const hindi: typeof english = {
  unsupported: "मैं Wiggy और Tomato पर खाना ढूँढने और कीमतों की तुलना करने में मदद कर सकती हूँ।",
  dish: (restaurant) => restaurant ? `${restaurant} से आप कौन सी डिश चाहेंगे?` : "आप कौन सी डिश ढूँढना चाहते हैं?",
  clarify: "इस खोज के लिए कौन सी डिश, जगह या पसंद इस्तेमाल करूँ?",
  location: (unknown) => unknown ? "यह जगह मार्केटप्लेस में नहीं मिली। कौन सा उपलब्ध शहर या इलाका इस्तेमाल करूँ?" : "किस शहर या इलाके में ढूँढूँ?",
  allergen: "इस सैंडबॉक्स में डेयरी, अंडा, ग्लूटेन, नट्स, मूँगफली और तिल की जाँच हो सकती है। इनमें से क्या हटाना है?",
  provider: (limited) => limited ? "मार्केटप्लेस ने अभी अनुरोध सीमित किए हैं। आपकी शर्तें सुरक्षित हैं। एक मिनट बाद फिर कोशिश करें।" : "मार्केटप्लेस का जवाब सत्यापित नहीं हो सका। आपकी शर्तें सुरक्षित हैं। फिर कोशिश करें।",
  incomplete: (count, more, providers, choose) => `${count ? `मैंने ${count} योग्य कीमतें सत्यापित कीं। ` : ""}${more ? "अभी और विकल्प जाँचना बाकी है।" : `${providers} की जाँच पूरी नहीं हुई।`} ${choose ? "सबसे कम कीमत अभी तय नहीं कर सकती।" : "खोज सीमित करें या फिर कोशिश करें।"}`,
  noMatch: (dish, location) => `${location} के पास ${dish} का कोई विकल्प आपकी शर्तों पर खरा नहीं उतरा। आप कौन सी शर्त बदलना चाहेंगे?`,
  results: (count, dish, location) => `${location} के पास ${dish} के ${count} योग्य विकल्प मिले। कुल कीमतों में शुल्क और कर शामिल हैं।`,
  selected: (dish, restaurant, provider, total) => `${provider} पर ${restaurant} की ${dish} का सबसे कम योग्य कुल ${total} है। शुल्क और कर शामिल हैं। इसे समीक्षा के लिए चुना है।`,
  approval: (provider, total) => `${provider} की कुल कीमत ${total} है, जिसमें शुल्क और कर शामिल हैं। क्या आप सिम्युलेटेड चेकआउट के लिए इसे मंज़ूर करना चाहेंगे?`,
  confirmation: (provider, reference) => `${provider} ने आपका सिम्युलेटेड ऑर्डर स्वीकार किया। आपका रेफ़रेंस ${reference} है। कोई पैसा नहीं लिया गया।`,
};

const telugu: typeof english = {
  unsupported: "Wiggy, Tomato లో వంటకాలను వెతికి ధరలను పోల్చడంలో నేను సహాయం చేయగలను.",
  dish: (restaurant) => restaurant ? `${restaurant} నుంచి ఏ వంటకం కావాలి?` : "మీరు ఏ వంటకం వెతకాలనుకుంటున్నారు?",
  clarify: "ఈ శోధనకు ఏ వంటకం, ప్రదేశం లేదా ప్రాధాన్యత తీసుకోవాలి?",
  location: (unknown) => unknown ? "ఈ ప్రదేశం మార్కెట్‌ప్లేస్‌లో దొరకలేదు. అందుబాటులో ఉన్న ఏ నగరం లేదా ప్రాంతాన్ని ఎంచుకోవాలి?" : "ఏ నగరం లేదా ప్రాంతంలో వెతకాలి?",
  allergen: "ఈ సాండ్‌బాక్స్‌లో పాల పదార్థాలు, గుడ్డు, గ్లూటెన్, గింజలు, వేరుశెనగలు, నువ్వులు మాత్రమే తనిఖీ చేయగలను. వీటిలో ఏది వద్దు?",
  provider: (limited) => limited ? "మార్కెట్‌ప్లేస్ అభ్యర్థనలను పరిమితం చేసింది. మీ షరతులు అలాగే ఉన్నాయి. ఒక నిమిషం తర్వాత మళ్లీ ప్రయత్నించండి." : "మార్కెట్‌ప్లేస్ జవాబును నిర్ధారించలేకపోయాను. మీ షరతులు అలాగే ఉన్నాయి. మళ్లీ ప్రయత్నించండి.",
  incomplete: (count, more, providers, choose) => `${count ? `${count} సరిపడే ధరలను నిర్ధారించాను. ` : ""}${more ? "మరికొన్ని ఎంపికలను తనిఖీ చేయాలి." : `${providers} తనిఖీ పూర్తికాలేదు.`} ${choose ? "అతి తక్కువ ధరను ఇంకా నిర్ధారించలేను." : "శోధనను కుదించండి లేదా మళ్లీ ప్రయత్నించండి."}`,
  noMatch: (dish, location) => `${location} దగ్గర ${dish} కోసం మీ షరతులకు సరిపోయే ధర దొరకలేదు. ఏ షరతు మార్చాలనుకుంటున్నారు?`,
  results: (count, dish, location) => `${location} దగ్గర ${dish} కోసం ${count} సరిపడే ధరలు దొరికాయి. మొత్తం ధరల్లో రుసుములు, పన్ను ఉన్నాయి.`,
  selected: (dish, restaurant, provider, total) => `${provider} లో ${restaurant} వారి ${dish} అతి తక్కువ అర్హమైన ధర ${total}. రుసుములు, పన్ను కలిపి ఉన్నాయి. మీ సమీక్ష కోసం ఎంచుకున్నాను.`,
  approval: (provider, total) => `${provider} తెలిపిన మొత్తం ధర ${total}. రుసుములు, పన్ను కలిపి ఉన్నాయి. సిమ్యులేటెడ్ చెక్అవుట్ కోసం ఈ మొత్తాన్ని ఆమోదిస్తారా?`,
  confirmation: (provider, reference) => `${provider} మీ సిమ్యులేటెడ్ ఆర్డర్‌ను నిర్ధారించింది. మీ రిఫరెన్స్ ${reference}. డబ్బు వసూలు కాలేదు.`,
};

const hinglish: typeof english = {
  ...hindi,
  noMatch: (dish, location) => `${location} के पास ${dish} का कोई eligible quote नहीं मिला। कौन सी condition बदलें?`,
  results: (count, dish, location) => `${location} के पास ${dish} के ${count} eligible quotes मिले। Total में fees और tax शामिल हैं।`,
  selected: (dish, restaurant, provider, total) => `${provider} पर ${restaurant} की ${dish} का cheapest eligible total ${total} है। Fees और tax शामिल हैं। इसे review के लिए चुना है।`,
  approval: (provider, total) => `${provider} का total ${total} है। Fees और tax शामिल हैं। क्या simulated checkout के लिए यह amount approve करें?`,
  confirmation: (provider, reference) => `${provider} ने आपका simulated order confirm किया। आपका reference ${reference} है। कोई पैसा नहीं लिया गया।`,
};

export const voiceReplies: Record<VoiceLocale, typeof english> = { "en-IN": english, "hi-IN": hindi, "te-IN": telugu, "hi-en": hinglish };

export function spokenPrice(paise: number, language: VoiceLocale) {
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  if (language === "te-IN") return `${rupees} రూపాయలు${fraction ? ` ${fraction} పైసలు` : ""}`;
  if (language === "hi-IN" || language === "hi-en") return `${rupees} रुपये${fraction ? ` ${fraction} पैसे` : ""}`;
  return `${rupees} rupees${fraction ? ` and ${fraction} paise` : ""}`;
}
