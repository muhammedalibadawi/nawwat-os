"""
Zenith ERP — AI Market Intelligence & Deal Sourcing Engine
PropTech AI pipeline for the UAE market (Dubai / Ajman).
"""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger("zenith.ai_deal_engine")

# ─────────────────────────────────────────────────────────────────────────────
# Enums & DTOs
# ─────────────────────────────────────────────────────────────────────────────
class OwnerIntentLevel:
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"

@dataclass
class RawMarketRecord:
    source_id: str
    source_name: str
    address: str
    emirate: str
    property_type: str
    size_sqft: float | None
    asking_price_aed: float | None
    listing_date: date
    owner_name: str | None
    owner_phone: str | None
    is_vacant: bool
    vacancy_days: int
    metadata: dict[str, Any] = field(default_factory=dict)

@dataclass
class EnrichedDeal:
    property_id: str
    address: str
    emirate: str
    property_type: str
    size_sqft: float | None
    asking_price_aed: float | None
    market_value_aed: float | None
    potential_upside: float | None
    intent_level: str
    intent_score: float
    owner_name: str | None
    owner_phone: str | None
    owner_email: str | None
    owner_linkedin: str | None
    is_owner_occupied: bool
    deal_priority: str
    ai_summary: str
    data_source: str
    last_updated: str

class DealSummaryResponse(BaseModel):
    property_id: str
    address: str
    emirate: str
    property_type: str
    size_sqft: float | None
    asking_price_aed: float | None
    market_value_aed: float | None
    potential_upside: float | None
    intent_level: str
    intent_score: float
    owner_name: str | None
    owner_phone: str | None
    owner_email: str | None
    owner_linkedin: str | None
    is_owner_occupied: bool
    deal_priority: str
    ai_summary: str
    data_source: str
    last_updated: str

class DailyDealsResponse(BaseModel):
    as_of_date: str
    total_scanned: int
    high_intent_count: int
    deals: list[DealSummaryResponse]
    pipeline_metadata: dict[str, Any]

# ─────────────────────────────────────────────────────────────────────────────
# MarketIntelligenceEngine
# ─────────────────────────────────────────────────────────────────────────────
class MarketIntelligenceEngine:
    _INTENT_WEIGHTS = {
        "vacancy_signal": 0.35,
        "multi_property": 0.20,
        "price_to_market": 0.20,
        "transaction_age": 0.15,
        "property_condition": 0.10,
    }
    _HIGH_INTENT_THRESHOLD = 0.65
    _MEDIUM_INTENT_THRESHOLD = 0.40

    def __init__(self, concurrency: int = 10):
        self._concurrency = concurrency
        self._scan_stats: dict[str, Any] = {}

    async def scan_market_data(self) -> list[RawMarketRecord]:
        active_sources = ["Bayut", "PropertyFinder", "DLD", "InternalCRM"]
        all_records = []
        
        async def _ingest_source(source_name: str):
            await asyncio.sleep(0.1)
            return self._mock_generate_records(source_name, count=5)

        tasks = [_ingest_source(s) for s in active_sources]
        results = await asyncio.gather(*tasks)
        for batch in results:
            all_records.extend(batch)

        self._scan_stats["total_raw"] = len(all_records)
        return all_records

    def _mock_generate_records(self, source: str, count: int) -> list[RawMarketRecord]:
        records = []
        for i in range(count):
            asking = round(random.uniform(400_000, 8_000_000), -3)
            records.append(RawMarketRecord(
                source_id=f"{source}-{uuid.uuid4().hex[:8]}",
                source_name=source,
                address=f"Plot {random.randint(1, 999)}, Dubai",
                emirate="Dubai",
                property_type="VILLA",
                size_sqft=round(random.uniform(600, 15_000), 1),
                asking_price_aed=asking,
                listing_date=date.today() - timedelta(days=random.randint(1, 180)),
                owner_name="Ahmed Al Mansoori",
                owner_phone="+971501234567",
                is_vacant=True,
                vacancy_days=random.randint(30, 730),
            ))
        return records

    async def verify_owner_intent(self, records: list[RawMarketRecord]) -> list[tuple[RawMarketRecord, float, str]]:
        classified = []
        for rec in records:
            score = round(random.uniform(0.3, 0.95), 4)
            level = OwnerIntentLevel.HIGH if score >= self._HIGH_INTENT_THRESHOLD else OwnerIntentLevel.MEDIUM
            if level in (OwnerIntentLevel.HIGH, OwnerIntentLevel.MEDIUM):
                classified.append((rec, score, level))
        
        self._scan_stats["high_intent"] = sum(1 for _, _, lvl in classified if lvl == OwnerIntentLevel.HIGH)
        return classified

    async def enrich_contact_data(self, classified: list[tuple[RawMarketRecord, float, str]]) -> list[EnrichedDeal]:
        enriched_deals = []
        for rec, score, level in classified:
            market_value = rec.asking_price_aed * random.uniform(0.85, 1.20) if rec.asking_price_aed else 0
            upside = round((market_value - rec.asking_price_aed) / rec.asking_price_aed, 4) if rec.asking_price_aed else 0
            
            priority = "HOT" if level == OwnerIntentLevel.HIGH and upside > 0.15 else "WARM"
            
            deal = EnrichedDeal(
                property_id=rec.source_id,
                address=rec.address,
                emirate=rec.emirate,
                property_type=rec.property_type,
                size_sqft=rec.size_sqft,
                asking_price_aed=rec.asking_price_aed,
                market_value_aed=round(market_value, 2),
                potential_upside=upside,
                intent_level=level,
                intent_score=score,
                owner_name=rec.owner_name,
                owner_phone=rec.owner_phone,
                owner_email=f"{rec.owner_name.replace(' ', '.').lower()}@gmail.com" if rec.owner_name else None,
                owner_linkedin=None,
                is_owner_occupied=False,
                deal_priority=priority,
                ai_summary=f"Vacant for {rec.vacancy_days} days. High ROI potential.",
                data_source=rec.source_name,
                last_updated=date.today().isoformat()
            )
            enriched_deals.append(deal)
        return enriched_deals

    async def run_pipeline(self) -> dict:
        raw = await self.scan_market_data()
        classified = await self.verify_owner_intent(raw)
        enriched = await self.enrich_contact_data(classified)
        enriched.sort(key=lambda x: x.intent_score, reverse=True)
        
        return {
            "as_of_date": date.today().isoformat(),
            "total_scanned": self._scan_stats.get("total_raw", 0),
            "high_intent_count": self._scan_stats.get("high_intent", 0),
            "pipeline_metadata": self._scan_stats,
            "deals": [deal.__dict__ for deal in enriched]
        }

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Router
# ─────────────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/v1/real-estate", tags=["AI Sourcing"])

@router.get("/daily-deals", response_model=DailyDealsResponse)
async def get_morning_deals():
    engine = MarketIntelligenceEngine()
    data = await engine.run_pipeline()
    return data