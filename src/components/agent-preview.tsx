"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Clock3, ListFilter, MapPin, Mic, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { BrandMark } from "./brand";
import { CategoryIcon } from "./category-icon";
import { ActionLink, Panel } from "./ui";
import { exampleRequest } from "@/lib/request";

const stages = [
  { label: "Request", icon: Mic, title: "What can Jugaad get done for you?", description: "A sample request with a budget, a search radius and a delivery preference." },
  { label: "Compare", icon: ListFilter, title: "Compare the whole offer.", description: "In the workspace, Wiggy and Tomato return quotes with delivery estimates, fees and taxes." },
  { label: "Approve", icon: Wallet, title: "Give the go-ahead.", description: "Review the itemized total before authorizing a simulated payment. Checkout requires a provider quote." },
  { label: "Receipt", icon: ReceiptText, title: "Keep a record of the booking.", description: "A receipt will appear here after the backend confirms a simulated payment and provider booking." },
] satisfies Array<{ label: string; icon: LucideIcon; title: string; description: string }>;

export function AgentPreview() {
  const [selection, setSelection] = useState({ index: 0, interacted: false });
  const reducedMotion = useReducedMotion();
  const selected = selection.index;
  const stage = stages[selected];
  const StageIcon = stage.icon;
  const shouldAnimate = selection.interacted && !reducedMotion;

  return (
    <Panel className="agent-preview" id="walkthrough">
      <div className="preview-header">
        <div className="preview-identity"><BrandMark /><span>Jugaad<span className="preview-identity__one"> One</span></span></div>
        <span className="preview-caption"><span aria-hidden="true" /> Product walkthrough</span>
      </div>
      <div className="preview-body">
        <div className="preview-stage-nav" role="group" aria-label="Walkthrough steps">
          {stages.map(({ label, icon: Icon }, index) => (
            <button key={label} type="button" aria-pressed={selected === index} onClick={() => setSelection({ index, interacted: true })}>
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </div>
        <div aria-live="polite" aria-atomic="true">
          <motion.div
            key={stage.label}
            initial={shouldAnimate ? { opacity: 0.8, y: 3 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldAnimate ? 0.2 : 0 }}
            className="preview-stage"
          >
            <div className="preview-stage-heading">
              {selected === 0 ? <CategoryIcon kind="voice" /> : <span className="preview-stage-symbol"><StageIcon size={25} aria-hidden="true" /></span>}
              <div><p className="meta preview-kicker">Step 0{selected + 1} of 04</p><h2>{stage.title}</h2></div>
            </div>
            {selected === 0 ? (
              <div className="preview-request">
                <p className="meta">Example request</p>
                <blockquote>“{exampleRequest.text}”</blockquote>
                <ul className="preview-constraints" aria-label="Example constraints">
                  <li><Wallet size={15} aria-hidden="true" /> ₹350 max</li>
                  <li><MapPin size={15} aria-hidden="true" /> Within 5 km</li>
                  <li><Clock3 size={15} aria-hidden="true" /> Fastest delivery</li>
                </ul>
              </div>
            ) : <div className="preview-request preview-explainer"><p>{stage.description}</p></div>}
          </motion.div>
        </div>
      </div>
      <div className="preview-footer">
        <span className="preview-caption">Sample only</span>
        <ActionLink href="/workspace?example=paneer" variant="quiet">Use this example <ArrowUpRight size={17} aria-hidden="true" /></ActionLink>
      </div>
    </Panel>
  );
}
