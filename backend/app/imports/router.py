from fastapi import APIRouter

from .csv_service import (
    import_csv,
    preview_csv,
    validate_csv_import,
)
from .schemas import (
    CsvImportRequest,
    CsvImportResponse,
    CsvPreviewRequest,
    CsvPreviewResponse,
    CsvValidationRequest,
    CsvValidationResponse,
)


router = APIRouter(
    prefix="/imports",
    tags=["imports"],
)


@router.post(
    "/csv/preview",
    response_model=CsvPreviewResponse,
)
def preview_csv_file(
    request: CsvPreviewRequest,
) -> CsvPreviewResponse:
    return preview_csv(
        request.file_path
    )


@router.post(
    "/csv/validate",
    response_model=CsvValidationResponse,
)
def validate_csv_file_import(
    request: CsvValidationRequest,
) -> CsvValidationResponse:
    return validate_csv_import(
        request
    )


@router.post(
    "/csv/import",
    response_model=CsvImportResponse,
)
def import_csv_file(
    request: CsvImportRequest,
) -> CsvImportResponse:
    return import_csv(
        request
    )