import express, { Router, type Request, type Response } from 'express';
import { isNew } from '../model/person.js';
import { validate } from '../validation/constraints.js';
import { Errors } from '../validation/errors.js';
import { encodeFormComponent, encodeUriStrict, javaStrip } from '../validation/javaText.js';
import { methodFallbacks } from '../web/errorHandling.js';
import { asyncHandler, intParam, redirect, render, requestParams } from '../web/view.js';
import { newOwner, OWNER_FIELDS, ownerConstraints, type Owner } from './model.js';
import type { OwnerRepository } from './ownerRepository.js';

const VIEWS_OWNER_CREATE_OR_UPDATE_FORM = 'owners/createOrUpdateOwnerForm.njk';
const PAGE_SIZE = 5;
const MENU = 'owners';

/** Data binding with `id` and `*.id` disallowed; multiple values for a String field are comma-joined like Spring. */
function bindOwner(owner: Owner, req: Request): void {
	const params = requestParams(req);
	for (const field of OWNER_FIELDS) {
		const values = params.get(field);
		if (values !== undefined) {
			owner[field] = values.join(',');
		}
	}
}

function formModel(owner: Owner, errors?: Errors) {
	const fields = OWNER_FIELDS.map((name) => ({ name, value: owner[name] ?? '', errors: errors?.messagesFor(name) ?? [] }));
	return { owner, isNew: isNew(owner), fields, menu: MENU };
}

/** Port of OwnerController. */
export function ownerRoutes(owners: OwnerRepository): Router {
	const router = Router({ strict: true });
	// Parse form bodies only on these routes: requests passed on to the legacy app must keep their body stream.
	const formBody = express.urlencoded({ extended: false });

	/** @ModelAttribute("owner"): resolved before every handler that has an {ownerId}. */
	async function findOwner(rawOwnerId: string | undefined): Promise<Owner> {
		if (rawOwnerId === undefined) {
			return newOwner();
		}
		const ownerId = intParam(rawOwnerId, 'ownerId');
		const owner = await owners.findById(ownerId);
		if (!owner) {
			throw new Error(`Owner not found with id: ${ownerId}. Please ensure the ID is correct and the owner exists in the database.`);
		}
		return owner;
	}

	router.get('/owners/new', (_req, res) => {
		render(res, VIEWS_OWNER_CREATE_OR_UPDATE_FORM, formModel(newOwner()));
	});

	router.post('/owners/new', formBody, asyncHandler(async (req, res) => {
		const owner = newOwner();
		bindOwner(owner, req);
		const errors = new Errors('owner', res.locals.locale);
		validate(owner, ownerConstraints, errors, res.locals.locale);
		if (errors.hasErrors()) {
			render(res, VIEWS_OWNER_CREATE_OR_UPDATE_FORM, formModel(owner, errors));
			return;
		}
		await owners.save(owner);
		redirect(req, res, `/owners/${owner.id}`, { message: 'New Owner Created' });
	}));
	methodFallbacks(router, '/owners/new', ['GET', 'POST']);

	router.get('/owners/find', (_req, res) => {
		render(res, 'owners/findOwners.njk', { owner: newOwner(), errors: [], menu: MENU });
	});
	methodFallbacks(router, '/owners/find', ['GET']);

	router.get('/owners', asyncHandler(async (req: Request, res: Response) => {
		const page = intParam(req.query.page, 'page', 1);
		const owner = newOwner();
		bindOwner(owner, req);
		const lastName = owner.lastName == null ? '' : javaStrip(owner.lastName);

		const results = await owners.findByLastNameStartingWith(lastName, Math.max(page, 1) - 1, PAGE_SIZE);
		if (page < 1 || page > Math.max(results.totalPages, 1)) {
			redirect(req, res, `/owners?page=1${lastName ? `&lastName=${encodeFormComponent(lastName)}` : ''}`);
			return;
		}
		if (results.content.length === 0) {
			const errors = new Errors('owner', res.locals.locale);
			errors.rejectValue('lastName', 'notFound', 'not found');
			render(res, 'owners/findOwners.njk', { owner, errors: errors.allMessages(), menu: MENU });
			return;
		}
		if (results.totalElements === 1) {
			redirect(req, res, `/owners/${results.content[0]?.id}`);
			return;
		}
		render(res, 'owners/ownersList.njk', {
			currentPage: page,
			totalPages: results.totalPages,
			totalItems: results.totalElements,
			listOwners: results.content,
			menu: MENU,
		});
	}));
	methodFallbacks(router, '/owners', ['GET']);

	router.get('/owners/:ownerId/edit', asyncHandler(async (req, res) => {
		const owner = await findOwner(req.params.ownerId);
		render(res, VIEWS_OWNER_CREATE_OR_UPDATE_FORM, formModel(owner));
	}));

	router.post('/owners/:ownerId/edit', formBody, asyncHandler(async (req, res) => {
		const rawOwnerId = req.params.ownerId as string;
		const owner = await findOwner(rawOwnerId);
		const ownerId = intParam(rawOwnerId, 'ownerId');
		bindOwner(owner, req);
		const errors = new Errors('owner', res.locals.locale);
		validate(owner, ownerConstraints, errors, res.locals.locale);
		if (errors.hasErrors()) {
			render(res, VIEWS_OWNER_CREATE_OR_UPDATE_FORM, formModel(owner, errors));
			return;
		}
		// "redirect:/owners/{ownerId}" expands the raw path variable.
		const ownerPath = `/owners/${encodeUriStrict(rawOwnerId)}`;
		if (owner.id !== ownerId) {
			redirect(req, res, `${ownerPath}/edit`, { error: 'Owner ID mismatch. Please try again.' });
			return;
		}
		await owners.save(owner);
		redirect(req, res, ownerPath, { message: 'Owner Values Updated' });
	}));
	methodFallbacks(router, '/owners/:ownerId/edit', ['GET', 'POST']);

	router.get('/owners/:ownerId', asyncHandler(async (req, res) => {
		const owner = await findOwner(req.params.ownerId);
		render(res, 'owners/ownerDetails.njk', { owner, menu: MENU });
	}));
	methodFallbacks(router, '/owners/:ownerId', ['GET']);

	return router;
}
