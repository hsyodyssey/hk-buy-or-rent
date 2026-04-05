"use client";

import { useState, useEffect } from "react";
import { REGIONS } from "@/lib/regionData";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  onSelect: (districtIdx: number) => void;
  selectedIdx: number;
}

export default function RegionSelector({ onSelect, selectedIdx }: Props) {
  const { t } = useLanguage();
  
  const [activeRegionCode, setActiveRegionCode] = useState<string | null>(null);
  const [activeSubDistrictCode, setActiveSubDistrictCode] = useState<string | null>(null);

  // Sync internal state with external selectedIdx
  useEffect(() => {
    if (selectedIdx >= 0) {
      for (const region of REGIONS) {
        for (const sd of region.subDistricts) {
          if (sd.hmas.some(hma => hma.districtIdx === selectedIdx)) {
            setActiveRegionCode(region.code);
            setActiveSubDistrictCode(sd.code);
            return;
          }
        }
      }
    }
  }, [selectedIdx]);

  const activeRegion = REGIONS.find(r => r.code === activeRegionCode);
  const activeSubDistrict = activeRegion?.subDistricts.find(sd => sd.code === activeSubDistrictCode);
  const selectedHma = activeSubDistrict?.hmas.find(hma => hma.districtIdx === selectedIdx);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden transition-all">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          
          {/* L1: Regions */}
          <div className="p-3 bg-stone-50/50">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
              {t("estimator.region")}
            </div>
            <div className="space-y-1">
              {REGIONS.map(region => {
                const isSelected = activeRegionCode === region.code;
                return (
                  <button
                    key={region.code}
                    onClick={() => {
                      setActiveRegionCode(region.code);
                      setActiveSubDistrictCode(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      isSelected
                        ? "bg-teal-50 text-teal-700 font-medium border border-teal-500"
                        : "bg-transparent text-zinc-700 hover:bg-stone-100 border border-transparent"
                    }`}
                  >
                    {region.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* L2: Sub-districts */}
          <div className="p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
              {t("estimator.selectSubDistrict")}
            </div>
            {!activeRegion ? (
              <div className="px-3 py-4 text-sm text-zinc-400 italic">
                {t("estimator.selectRegion")}
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {activeRegion.subDistricts.map(sd => {
                  const validHmas = sd.hmas.filter(h => h.districtIdx >= 0);
                  if (validHmas.length === 0) return null;

                  const isSelected = activeSubDistrictCode === sd.code;

                  return (
                    <div 
                      key={sd.code}
                      className={`rounded-lg border transition-all overflow-hidden ${
                        isSelected
                          ? "border-teal-500 bg-teal-50"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setActiveSubDistrictCode(sd.code);
                          if (sd.primaryIdx >= 0) {
                            onSelect(sd.primaryIdx);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${
                          isSelected ? "text-teal-700" : "text-zinc-800"
                        }`}
                      >
                        <span className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                          {sd.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          isSelected 
                            ? "bg-teal-100 text-teal-700 border-teal-200" 
                            : "bg-stone-100 text-zinc-500 border-stone-200"
                        }`}>
                          {validHmas.length}{t("estimator.areas")}
                        </span>
                      </button>
                      
                      {/* L3: HMAs (Optional drill-down) */}
                      {isSelected && validHmas.length > 1 && (
                        <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">
                          {validHmas.map(hma => {
                            const isHmaSelected = selectedIdx === hma.districtIdx;
                            return (
                              <button
                                key={hma.code}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelect(hma.districtIdx);
                                }}
                                className={`text-xs px-2 py-1 rounded-md transition-all border ${
                                  isHmaSelected
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "bg-white text-zinc-600 border-stone-200 hover:border-teal-300 hover:text-teal-600"
                                }`}
                              >
                                {hma.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Badge */}
      {activeSubDistrict && selectedHma && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-teal-600 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {activeRegion?.name} · {activeSubDistrict.name}
            {selectedHma.name !== activeSubDistrict.name && ` · ${selectedHma.name}`}
          </span>
        </div>
      )}
    </div>
  );
}
