from fastapi import HTTPException, status
class EntityNotFoundException(HTTPException):
    def __init__(self, entity_name: str, entity_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} with ID {entity_id} not found "
        )
class BusinessRuleViolationException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )