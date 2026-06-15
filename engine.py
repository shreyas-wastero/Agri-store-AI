"""
recommendations/engine.py

AI Scoring Engine for AgriStore AI
Ranks warehouses using a weighted multi-factor score.

Factors (total = 100 pts):
  ① Crop Compatibility  — 30 pts
  ② Distance           — 25 pts  (Haversine formula)
  ③ Capacity Match     — 20 pts
  ④ User Rating        — 15 pts
  ⑤ Price Value        — 10 pts
"""

import math
from decimal import Decimal


# ─── HAVERSINE DISTANCE ──────────────────────────────────────────────────────
def haversine_km(lat1, lon1, lat2, lon2):
    """Return distance in km between two lat/lng points."""
    R = 6371  # Earth radius km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── INDIVIDUAL FACTOR SCORES ────────────────────────────────────────────────
def score_crop(warehouse, crop_type: str) -> float:
    """30 pts — exact match, else 0."""
    crops = warehouse.compatible_crops or []
    if crop_type in crops or 'general' in crops:
        return 30.0
    return 0.0


def score_distance(warehouse, user_lat: float, user_lng: float) -> float:
    """
    25 pts — linear decay: 0 km → 25 pts, 100 km → 0 pts.
    Falls back to 12.5 (city match) if user has no coords.
    """
    if user_lat is None or user_lng is None:
        return 12.5  # neutral
    km = haversine_km(user_lat, user_lng, warehouse.latitude, warehouse.longitude)
    return max(0.0, 25.0 * (1 - km / 100))


def score_capacity(warehouse, quantity: float) -> float:
    """20 pts — full fit → 20, partial → proportional, over → 0."""
    avail = warehouse.available_capacity
    if quantity <= 0:
        return 10.0  # neutral
    if avail >= quantity:
        return 20.0
    if avail > 0:
        return 20.0 * (avail / quantity)
    return 0.0


def score_rating(warehouse) -> float:
    """15 pts — scales with rating (0–5)."""
    return (warehouse.rating / 5.0) * 15.0


def score_price(warehouse) -> float:
    """
    10 pts — price relative to ₹200–₹800 range.
    Cheaper = more points.
    """
    price = float(warehouse.price_per_tonne)
    MIN_PRICE, MAX_PRICE = 200.0, 800.0
    normalised = (MAX_PRICE - price) / (MAX_PRICE - MIN_PRICE)
    return max(0.0, min(10.0, normalised * 10.0))


# ─── COMPOSITE SCORE ─────────────────────────────────────────────────────────
def calculate_ai_score(warehouse, crop_type: str, quantity: float,
                        user_lat: float = None, user_lng: float = None) -> int:
    """Return 0–100 AI match score."""
    total = (
        score_crop(warehouse, crop_type) +
        score_distance(warehouse, user_lat, user_lng) +
        score_capacity(warehouse, quantity) +
        score_rating(warehouse) +
        score_price(warehouse)
    )
    return min(100, round(total))


# ─── RANK & ANNOTATE LIST ────────────────────────────────────────────────────
def rank_warehouses(warehouses, crop_type: str, quantity: float,
                    user_lat: float = None, user_lng: float = None):
    """
    Given a queryset of Warehouse objects, return a list sorted by AI score (desc).
    Each object gets a transient `.ai_score` attribute.
    """
    scored = []
    for wh in warehouses:
        wh.ai_score = calculate_ai_score(wh, crop_type, quantity, user_lat, user_lng)
        if user_lat and user_lng:
            wh.distance_km = round(
                haversine_km(user_lat, user_lng, wh.latitude, wh.longitude), 1
            )
        else:
            wh.distance_km = None
        scored.append(wh)

    scored.sort(key=lambda w: w.ai_score, reverse=True)
    return scored
