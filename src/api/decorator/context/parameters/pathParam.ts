import { PathParameterExtractor } from "../../../parameters/PathParameterExtractor"
import { DecoratorRegistry } from "../../../reflection/DecoratorRegistry"

export function pathParam(paramName?: string) {
    return (classDefinition: Object | Function, methodName: string, paramIndex: number) => {
        let controller = DecoratorRegistry.getOrCreateController(classDefinition.constructor)
        let endpoint = DecoratorRegistry.getOrCreateEndpoint(controller, methodName)

        endpoint.parameterExtractors[paramIndex] = new PathParameterExtractor(paramName)
    }
}
