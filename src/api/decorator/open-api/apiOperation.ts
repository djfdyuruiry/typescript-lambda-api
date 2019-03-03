import { DecoratorRegistry } from "../../reflection/DecoratorRegistry"
import { ApiOperationInfo } from "../../../model/open-api/ApiOperationInfo"

/**
 * Decorator that can be placed on an endpoint to describe it in any generated
 * OpenAPI specification.
 *
 * @param apiOperationInfo Information about this api operation; will be merged with
 *                         existing info if present, replacing any existing properties,
 *                         if provided in this parameter.
 */
export function apiOperation(apiOperationInfo: ApiOperationInfo) {
    return (classDefinition: Object, methodName: string) => {
        let controller = DecoratorRegistry.getOrCreateController(classDefinition.constructor)
        let endpoint = DecoratorRegistry.getOrCreateEndpoint(controller, methodName)

        endpoint.getOrCreateApiOperationInfo().mergeInfo(apiOperationInfo)
    }
}
