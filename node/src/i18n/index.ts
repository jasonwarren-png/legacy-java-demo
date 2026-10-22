import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageSource } from './messageSource.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The Spring app's own bundles (spring.messages.basename=messages/messages), shared unchanged. */
export const messages = new MessageSource(resolve(projectRoot, '../src/main/resources/messages'), 'messages');

/** Hibernate Validator's default constraint messages, all locales (copied from hibernate-validator 9.1.0.Final, Apache-2.0). */
export const validationMessages = new MessageSource(resolve(projectRoot, 'i18n'), 'ValidationMessages');
