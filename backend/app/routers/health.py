from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/")
async def health_check():
    return {
        "status": "online",
        "system": "Nawwat OS Core SaaS",
        "modules_active": ["Core", "Real Estate AI Engine"]
    }


@router.get("/api/v1/health")
def api_health():
    print("\n==============================", flush=True)
    print("🚀 API IS ALIVE AND LISTENING 🚀", flush=True)
    print("==============================\n", flush=True)
    return {"status": "ok", "message": "API IS ALIVE"}
