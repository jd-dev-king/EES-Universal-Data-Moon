from uuid import UUID

from fastapi import (
    APIRouter,
    HTTPException,
)

from .schemas import (
    DatasetCreate,
    DatasetResponse,
    RegistryDiscoveryPreviewRequest,
    RegistryDiscoveryPreviewResponse,
    RegistryDiscoveryRequest,
    RegistryDiscoveryResponse,
    RegistryOverviewResponse,
    RelationshipCreate,
    RelationshipResponse,
    SystemCreate,
    SystemResponse,
)

from .service import (
    create_dataset,
    create_relationship,
    create_system,
    get_registry_overview,
    get_system,
    list_datasets,
    list_systems,
    preview_registry_discovery,
    register_discovered_datasets,
)


router = APIRouter(
    prefix="/registry",
    tags=["EES Registry"],
)


@router.get(
    "/overview",
    response_model=RegistryOverviewResponse,
)
def registry_overview():
    return get_registry_overview()


@router.get(
    "/systems",
    response_model=list[SystemResponse],
)
def registry_systems():
    return list_systems()


@router.get(
    "/systems/{system_id}",
    response_model=SystemResponse,
)
def registry_system(
    system_id: UUID,
):
    system = get_system(
        system_id
    )

    if system is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "EES system not found."
            ),
        )

    return system


@router.post(
    "/systems",
    response_model=SystemResponse,
    status_code=201,
)
def registry_create_system(
    payload: SystemCreate,
):
    return create_system(
        payload
    )


@router.get(
    "/datasets",
    response_model=list[DatasetResponse],
)
def registry_datasets(
    system_id: UUID | None = None,
):
    return list_datasets(
        system_id
    )


@router.post(
    "/datasets",
    response_model=DatasetResponse,
    status_code=201,
)
def registry_create_dataset(
    payload: DatasetCreate,
):
    return create_dataset(
        payload
    )


@router.post(
    "/relationships",
    response_model=RelationshipResponse,
    status_code=201,
)
def registry_create_relationship(
    payload: RelationshipCreate,
):
    return create_relationship(
        payload
    )


@router.post(
    "/discover/preview",
    response_model=(
        RegistryDiscoveryPreviewResponse
    ),
)
def registry_discovery_preview(
    payload:
        RegistryDiscoveryPreviewRequest,
):
    return preview_registry_discovery(
        payload
    )


@router.post(
    "/discover",
    response_model=(
        RegistryDiscoveryResponse
    ),
)
def registry_discovery(
    payload:
        RegistryDiscoveryRequest,
):
    return register_discovered_datasets(
        payload
    )