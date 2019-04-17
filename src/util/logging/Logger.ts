import { inspect } from "util"

import { sprintf } from "sprintf-js"

import { ILogger, LogFormat } from "./ILogger"
import { LogLevel } from "../../model/logging/LogLevel"

export class Logger implements ILogger {
    private readonly useStringLogFormat: boolean

    public constructor(
        private readonly clazz: string,
        public readonly level: LogLevel,
        public readonly format: LogFormat
    ) {
        this.useStringLogFormat = this.format === "string"
    }

    public log(level: LogLevel, message: string, ...formatArgs: any[]) {
        if (level < this.level) {
            return
        }

        let uppercaseLevel = LogLevel[level].toUpperCase()
        let now = new Date()
        let formattedMessage = message

        if (formatArgs && formatArgs.length > 0) {
            try {
                formattedMessage = sprintf(message, ...formatArgs)
            } catch (ex) {
                this.errorWithStack(
                    "Failed to format log message, raw log message and parameters will be output",
                    ex
                )

                formattedMessage = `${message}\n${inspect(formatArgs)}`
            }
        }

        if (this.useStringLogFormat) {
            console.log(
                "%s %s %s - %s",
                now.toISOString(),
                uppercaseLevel,
                this.clazz,
                formattedMessage
            )
        } else {
            console.log(
                JSON.stringify({
                    level: uppercaseLevel,
                    msg: formattedMessage,
                    time: now.getTime()
                })
            )
        }
    }

    public trace(message: string, ...formatArgs: any[]) {
        this.log(LogLevel.trace, message, ...formatArgs)
    }

    public debug(message: string, ...formatArgs: any[]) {
        this.log(LogLevel.debug, message, ...formatArgs)
    }

    public info(message: string, ...formatArgs: any[]) {
        this.log(LogLevel.info, message, ...formatArgs)
    }

    public warn(message: string, ...formatArgs: any[]) {
        this.log(LogLevel.warn, message, ...formatArgs)
    }

    public error(message: string, ...formatArgs: any[]) {
        this.log(LogLevel.error, message, ...formatArgs)
    }

    public errorWithStack(message: string, ex: Error, ...formatArgs: any[]) {
        this.log(LogLevel.error, `${message}\n${ex ? ex.stack : ""}`, ...formatArgs)
    }

    public fatal(message: string, ...formatArgs: any[]) {
        this.log(LogLevel.fatal, message, ...formatArgs)
    }
}
