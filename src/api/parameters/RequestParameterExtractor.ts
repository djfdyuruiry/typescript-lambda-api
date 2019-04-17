import { inspect } from "util"

import { Request } from "lambda-api"

import { LogLevel } from "../../model/logging/LogLevel"
import { BaseParameterExtractor } from "./BaseParameterExtractor"

export class RequestParameterExtractor extends BaseParameterExtractor {
    public readonly source = "virtual"
    public readonly name = "request"

    public constructor() {
        super(RequestParameterExtractor)
    }

    public extract(request: Request) {
        this.logger.debug("Injecting request as parameter")

        if (this.logger.level === LogLevel.trace) {
            this.logger.trace("Request:\n%s", inspect(request))
        }

        return request
    }
}
