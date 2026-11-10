"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { FoodLocation } from "@/lib/marketplace/discovery-types";
import type { MarketplaceCity, MarketplaceResult } from "@/lib/marketplace/schemas";
import { requestJson } from "@/lib/client-request";
import { Button } from "./ui";

type CityState = { kind: "loading" } | { kind: "ready"; cities: MarketplaceCity[] } | { kind: "error"; message: string };

export function FoodLocationFields({ location, onChange }: { location: FoodLocation | null; onChange: (location: FoodLocation | null) => void }) {
  const [state, setState] = useState<CityState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const gpsRequest = useRef(0);
  const manual = location?.source === "manual" ? location : null;
  const selectedCity = state.kind === "ready" ? state.cities.find(({ id }) => id === manual?.cityId) : undefined;

  useEffect(() => {
    const controller = new AbortController();
    requestJson<MarketplaceResult<{ cities: MarketplaceCity[] }>>("/api/marketplace/cities", { signal: controller.signal }).then(
      ({ data }) => { if (!controller.signal.aborted) setState({ kind: "ready", cities: data.cities }); },
      (error: Error) => { if (!controller.signal.aborted) setState({ kind: "error", message: error.message }); },
    );
    return () => { controller.abort(); gpsRequest.current += 1; };
  }, [attempt]);

  function selectManual(next: FoodLocation | null) {
    gpsRequest.current += 1;
    setLocating(false);
    setStatus("");
    onChange(next);
  }

  function useGps() {
    if (!navigator.geolocation) {
      setStatus("Device location is unavailable. Choose a city manually.");
      return;
    }
    const request = ++gpsRequest.current;
    setLocating(true);
    setStatus("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== gpsRequest.current) return;
      setLocating(false);
      setStatus("Device location selected for this search.");
      onChange({ source: "gps", coordinates: { latitude: Number(coords.latitude.toFixed(5)), longitude: Number(coords.longitude.toFixed(5)) } });
    }, (error) => {
      if (request !== gpsRequest.current) return;
      setLocating(false);
      setStatus(error.code === 1 ? "Location permission was declined. Choose a city manually." : "Device location could not be read. Choose a city manually.");
    }, { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 });
  }

  return (
    <fieldset className="food-location">
      <legend className="location-label"><MapPin size={16} aria-hidden="true" /> Food delivery location</legend>
      <div className="marketplace-actions">
        {location?.source === "gps"
          ? <Button variant="quiet" onClick={() => selectManual(null)}>Change location</Button>
          : <Button variant="secondary" onClick={useGps} disabled={locating}>{locating ? "Finding location…" : "Use my location"}</Button>}
      </div>
      {status && <p className="workspace-help" role="status">{status}</p>}
      {location?.source !== "gps" && <>
        {state.kind === "loading" && <p className="workspace-help" role="status">Loading supported cities…</p>}
        {state.kind === "error" && <><p className="field-error" role="alert">{state.message}</p><Button variant="quiet" onClick={() => { setState({ kind: "loading" }); setLocating(false); setStatus(""); setAttempt((value) => value + 1); }}>Reload cities</Button></>}
        {state.kind === "ready" && <>
          <div className="workspace-field">
            <label htmlFor="food-city">Choose city</label>
            <select id="food-city" value={manual?.cityId ?? ""} onChange={(event) => selectManual(event.target.value ? { source: "manual", cityId: event.target.value } : null)}>
              <option value="">Select a city</option>
              {state.cities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          {selectedCity && <div className="workspace-field">
            <label htmlFor="food-neighborhood">Choose neighborhood</label>
            <select id="food-neighborhood" value={manual?.neighborhoodId ?? ""} onChange={(event) => selectManual({ source: "manual", cityId: selectedCity.id, neighborhoodId: event.target.value || undefined })}>
              <option value="">Use city center</option>
              {selectedCity.neighborhoods.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>}
        </>}
      </>}
      <p className="workspace-help">Search radius is straight-line distance from the selected location.</p>
    </fieldset>
  );
}
