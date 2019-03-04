import { OpenApiBuilder } from "openapi3-ts"
import {
    OperationObject,
    PathItemObject,
    ParameterObject,
    ContentObject,
    ResponseObject,
    TagObject,
    RequestBodyObject,
    MediaTypeObject
} from "openapi3-ts/dist/model"

import { DecoratorRegistry } from "../reflection/DecoratorRegistry"
import { ApiBodyInfo } from "../../model/open-api/ApiBodyInfo"
import { ControllerInfo } from "../../model/reflection/ControllerInfo"
import { EndpointInfo } from "../../model/reflection/EndpointInfo"
import { IDictionary } from "../../util/IDictionary"
import { timed } from "../../util/timed";

export type OpenApiFormat = "json" | "yml"

export class OpenApiGenerator {
    private static readonly ENDPOINTS = DecoratorRegistry.Endpoints

    @timed
    public static buildOpenApiSpec(basicAuthEnabled?: boolean) {
        return OpenApiGenerator.generateApiOpenApiSpecBuilder(basicAuthEnabled).getSpec()
    }

    @timed
    public static async exportOpenApiSpec(
        format: OpenApiFormat = "json",
        basicAuthEnabled?: boolean
    ) {
        let openApiBuilder = OpenApiGenerator.generateApiOpenApiSpecBuilder(basicAuthEnabled)

        if (format === "json") {
            return openApiBuilder.getSpecAsJson()
        }

        try {
            const jsyaml = await import("js-yaml")

            return jsyaml.safeDump(openApiBuilder.getSpec())
        } catch (ex) {
            // TODO: log warning to check that `js-yaml` needs to be installed for yml specs
            throw ex
        }
    }

    private static generateApiOpenApiSpecBuilder(basicAuthEnabled: boolean) {
        let openApiBuilder = OpenApiBuilder.create()
        let paths: IDictionary<PathItemObject> = {}
        let tags: IDictionary<TagObject> = {}

        if (basicAuthEnabled) {
            openApiBuilder = openApiBuilder.addSecurityScheme("basic", {
                scheme: "Basic",
                type: "http"
            })
        }

        OpenApiGenerator.discoverTagsAndPaths(paths, tags)

        // add all discovered tags
        for (let tag in tags) {
            if (!tags.hasOwnProperty(tag)) {
                continue
            }

            openApiBuilder = openApiBuilder.addTag(tags[tag])
        }

        // add all discovered paths
        for (let path in paths) {
            if (!paths.hasOwnProperty(path)) {
                continue
            }

            openApiBuilder = openApiBuilder.addPath(path, paths[path])
        }

        return openApiBuilder
    }

    private static discoverTagsAndPaths(paths: IDictionary<PathItemObject>, tags: IDictionary<TagObject>) {
        for (let endpoint in OpenApiGenerator.ENDPOINTS) {
            if (!OpenApiGenerator.ENDPOINTS.hasOwnProperty(endpoint)) {
                continue
            }

            let endpointInfo = OpenApiGenerator.ENDPOINTS[endpoint]

            if (endpointInfo.controller) {
                OpenApiGenerator.addTagIfPresent(tags, endpointInfo.controller)
            }

            OpenApiGenerator.addEndpoint(paths, endpointInfo)
        }
    }

    private static addTagIfPresent(tags: IDictionary<TagObject>, controller: ControllerInfo) {
        if (!controller.apiName || tags[controller.apiName]) {
            // tag name not defined or already recorded
            return
        }

        tags[controller.apiName] = {
            description: controller.apiDescription,
            name: controller.apiName
        }
    }

    private static addEndpoint(
        paths: IDictionary<PathItemObject>,
        endpointInfo: EndpointInfo
    ) {
        let path = endpointInfo.fullPath

        if (path.endsWith("/")) {
            // trim trailing forward slash from path
            path = path.substring(0, path.length - 1)
        }

        let pathInfo: PathItemObject = paths[path] || {}
        let endpointMethod = endpointInfo.httpMethod.toLowerCase()
        let endpointOperation: OperationObject = {
            responses: {}
        }

        if (endpointInfo.requestContentType) {
            // user declared request content type
            OpenApiGenerator.setEndpointRequestContentType(
                endpointOperation,
                endpointInfo.requestContentType
            )
        }

        if (endpointInfo.responseContentType) {
            // user declared response content type
            OpenApiGenerator.setEndpointResponseContentType(
                endpointOperation, endpointInfo.responseContentType
            )
        } else {
            // default response content type
            OpenApiGenerator.setEndpointResponseContentType(
                endpointOperation, "application/json" // use lambda-api content-type default
            )
        }

        if (endpointInfo.apiOperationInfo) {
            // user declared endpoint info
            OpenApiGenerator.addEndpointOperationInfo(endpointInfo, endpointOperation)
        }

        OpenApiGenerator.addParametersToEndpoint(endpointOperation, endpointInfo)

        if (endpointInfo.getControllerPropOrDefault(c => c.apiName)) {
            // associate endpoint with controller tag name
            endpointOperation.tags = [endpointInfo.controller.apiName]
        }

        pathInfo[endpointMethod] = endpointOperation
        paths[path] = pathInfo
    }

    private static setEndpointRequestContentType(endpointOperation: OperationObject, requestContentType: string) {
        let requestBody: RequestBodyObject = {
            content: {}
        }
        let content: MediaTypeObject = {}

        requestBody.content[requestContentType] = content

        endpointOperation.requestBody = requestBody
    }

    private static addEndpointOperationInfo(endpointInfo: EndpointInfo, endpointOperation: OperationObject) {
        let operationInfo = endpointInfo.apiOperationInfo

        endpointOperation.summary = operationInfo.name
        endpointOperation.description = operationInfo.description

        for (let statusCode in operationInfo.responses) {
            if (!operationInfo.responses.hasOwnProperty(statusCode)) {
                continue
            }

            OpenApiGenerator.setEndpointResponseContentType(
                endpointOperation, endpointInfo.responseContentType || "application/json",
                statusCode, operationInfo.responses[statusCode]
            )
        }
    }

    private static setEndpointResponseContentType(
        endpointOperation: OperationObject, responseContentType: string,
        statusCode?: string, apiBodyInfo?: ApiBodyInfo
    ) {
        let response: ResponseObject

        if (apiBodyInfo) {
            let responseContent: ContentObject = {}
            responseContent[apiBodyInfo.contentType || responseContentType] = {}

            response = {
                content: responseContent,
                description: apiBodyInfo.description || ""
            }
        } else {
            let responseContent: ContentObject = {}
            responseContent[responseContentType] = {}

            response = {
                content: responseContent,
                description: "" // required or swagger ui will throw errors
            }
        }

        if (statusCode) {
            endpointOperation.responses[statusCode] = response
        } else {
            endpointOperation.responses.default = response
        }
    }

    private static addParametersToEndpoint(endpointOperation: OperationObject, endpointInfo: EndpointInfo) {
        endpointOperation.parameters = []

        endpointInfo.parameterExtractors.forEach(p => {
            if (p.source === "virtual") {
                return
            }

            let paramInfo: ParameterObject = {
                in: p.source,
                name: p.name,
                schema: {} // required, or breaks query parameters
            }

            if (p.source === "path") {
                // swagger ui will break if this is not set to true
                paramInfo.required = true
            }

            endpointOperation.parameters.push(paramInfo)
        })
    }
}
