import React from "react";
import { ArrowRight, Calendar, ChevronDown, Search, Users } from "lucide-react";

const TRAVELER_OPTIONS = ["1 Traveler", "2 Travelers", "3 Travelers", "4 Travelers", "5+ Travelers"];

export default function TravelSearchBar({ value, onChange, travelDate, onTravelDateChange, travelers, onTravelersChange }) {
  const goToDestinations = () => {
    document.getElementById("destinations")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="section-shell tt-search-wrap">
      <div className="tt-search-bar">
        <div className="tt-search-seg tt-search-seg--dest">
          <Search size={18} />
          <input
            placeholder="Search destination (e.g. Japan, Bali, Singapore)"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>

        <div className="tt-search-seg tt-search-seg--date">
          <Calendar size={18} />
          <div className="tt-search-seg-text">
            <span className="tt-search-seg-label">Travel Date</span>
            <input
              type="date"
              className="tt-search-seg-input"
              value={travelDate}
              onChange={e => onTravelDateChange(e.target.value)}
            />
          </div>
        </div>

        <div className="tt-search-seg tt-search-seg--travelers">
          <Users size={18} />
          <div className="tt-search-seg-text">
            <span className="tt-search-seg-label">Travelers</span>
            <select className="tt-search-seg-select" value={travelers} onChange={e => onTravelersChange(e.target.value)}>
              {TRAVELER_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={15} className="tt-search-seg-chevron" />
        </div>

        <button type="button" className="green-button tt-search-btn" onClick={goToDestinations}>
          Search Packages <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
