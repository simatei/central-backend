const should = require('should');
const config = require('config');
const { DateTime } = require('luxon');
const { testService } = require('../setup');
const testData = require('../data');

describe('api: /forms', () => {
  describe('GET', () => {
    it('should reject unless the user can list', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.get('/v1/forms').expect(403))));

    it('should list forms in order', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.get('/v1/forms')
          .expect(200)
          .then(({ body }) => {
            body.forEach((form) => form.should.be.a.Form());
            body.map((form) => form.xmlFormId).should.eql([ 'withrepeat', 'simple' ]);
            body.map((form) => form.hash).should.eql([ 'e7e9e6b3f11fca713ff09742f4312029', '5c09c21d4c71f2f13f6aa26227b2d133' ]);
            body.map((form) => form.version).should.eql([ '1.0', '' ]);
          }))));

    it('should provide extended metadata if requested', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/forms/simple/submissions')
          .send(testData.instances.simple.one)
          .set('Content-Type', 'application/xml')
          .expect(200)
          .then(() => asAlice.get('/v1/forms')
            .set('X-Extended-Metadata', 'true')
            .expect(200)
            .then(({ body }) => {
              body.forEach((form) => form.should.be.an.ExtendedForm());
              const simple = body.find((form) => form.xmlFormId === 'simple');
              simple.submissions.should.equal(1);
              simple.lastSubmission.should.be.a.recentIsoDate();
            })))));
  });

  describe('../formList GET', () => {
    it('should reject unless the user can list', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.get('/v1/formlist')
          .set('X-OpenRosa-Version', '1.0')
          .set('Date', DateTime.local().toHTTP())
          .expect(403))));

    it('should return form details as xml', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.get('/v1/formlist')
          .set('X-OpenRosa-Version', '1.0')
          .set('Date', DateTime.local().toHTTP())
          .expect(200)
          .then(({ text, headers }) => {
            // Collect is particular about this:
            headers['content-type'].should.equal('text/xml; charset=utf-8');

            const domain = config.get('default.env.domain');
            text.should.equal(`<?xml version="1.0" encoding="UTF-8"?>
  <xforms xmlns="http://openrosa.org/xforms/xformsList">
    <xform>
      <formID>withrepeat</formID>
      <name>withrepeat</name>
      <version>1.0</version>
      <hash>md5:e7e9e6b3f11fca713ff09742f4312029</hash>
      <downloadUrl>${domain}/v1/forms/withrepeat.xml</downloadUrl>
    </xform>
    <xform>
      <formID>simple</formID>
      <name>Simple</name>
      <version></version>
      <hash>md5:5c09c21d4c71f2f13f6aa26227b2d133</hash>
      <downloadUrl>${domain}/v1/forms/simple.xml</downloadUrl>
    </xform>
  </xforms>`);
          }))));

    it('should not include closing/closed forms', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.patch('/v1/forms/withrepeat')
          .send({ state: 'closing' })
          .expect(200)
          .then(() => asAlice.patch('/v1/forms/simple')
            .send({ state: 'closing' })
            .expect(200)
            .then(() => asAlice.get('/v1/formList')
              .set('X-OpenRosa-Version', '1.0')
              .set('Date', DateTime.local().toHTTP())
              .expect(200)
              .then(({ text }) => {
                text.should.equal(`<?xml version="1.0" encoding="UTF-8"?>
  <xforms xmlns="http://openrosa.org/xforms/xformsList">
  </xforms>`);
              }))))));
  });

  describe('POST', () => {
    it('should reject unless the user can create', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.post('/v1/forms')
          .send(testData.forms.simple2)
          .set('Content-Type', 'application/xml')
          .expect(403))));

    it('should reject if the xml is malformed', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/forms')
          .send('<hello')
          .set('Content-Type', 'application/xml')
          .expect(400)
          .then(({ body }) => {
            body.code.should.equal(400.2);
            body.details.field.should.equal('formId');
            /* gh #45 when we have a real xml validator this should be the response:
            body.code.should.equal(400.1);
            body.details.should.eql({ format: 'xml', rawLength: 6 });*/
          }))));

    it('should reject if the form id cannot be found', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/forms')
          .send('<test/>')
          .set('Content-Type', 'application/xml')
          .expect(400)
          .then(({ body }) => {
            body.code.should.equal(400.2);
            body.details.should.eql({ field: 'formId' });
          }))));

    it('should reject if the form id already exists', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/forms')
          .send(testData.forms.simple)
          .set('Content-Type', 'application/xml')
          .expect(400)
          .then(({ body }) => {
            body.code.should.equal(400.5);
            body.details.fields.should.eql([ 'xmlFormId' ]);
            body.details.values.should.eql([ 'simple' ]);
          }))));

    // the simple form has no version declaration at all, which is what we want
    // to test, as postgres does not enforce uniqueness on null values. the
    // simple form is preloaded as part of the initial fixtures so we simply start
    // by deleting it.
    it('should reject if an empty form version already existed but was deleted', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.delete('/v1/forms/simple')
          .expect(200)
          .then(() => asAlice.post('/v1/forms')
            .send(testData.forms.simple)
            .set('Content-Type', 'application/xml')
            .expect(400)
            .then(({ body }) => {
              body.details.fields.should.eql([ 'xmlFormId', 'version' ]);
              body.details.values.should.eql([ 'simple', '' ]);
            })))));

    it('should return the created form upon success', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/forms')
          .send(testData.forms.simple2)
          .set('Content-Type', 'application/xml')
          .expect(200)
          .then(({ body }) => {
            body.should.be.a.Form();
            body.name.should.equal('Simple 2');
            body.version.should.equal('2.1');
            body.hash.should.equal('07ed8a51cc3f6472b7dfdc14c2005861');
          }))));
  });

  describe('/:id.xml GET', () => {
    it('should reject unless the user can read', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.get('/v1/forms/simple.xml').expect(403))));

    it('should return just xml', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.get('/v1/forms/simple')
          .expect(200)
          .then((full) => 
            asAlice.get('/v1/forms/simple.xml')
              .expect(200)
              .then(({ text }) => {
                full.body.xml.should.equal(text);
              })))));
  });

  describe('/:id.schema.json GET', () => {
    // we do not deeply test the JSON itself; that is done in test/unit/data/schema.js
    // here we just check all the plumbing.

    it('should reject unless the user can read', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.get('/v1/forms/simple.schema.json').expect(403))));

    it('should return a JSON schema structure', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.get('/v1/forms/simple.schema.json')
          .expect(200)
          .then(({ body }) => {
            body.should.eql([{
              name: 'meta', type: 'structure',
              children: [{ name: 'instanceID', type: 'string' }]
            }, {
              name: 'name', type: 'string',
            }, {
              name: 'age', type: 'int',
            }])
          }))));

    it('should return a flattened JSON schema structure', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.get('/v1/forms/simple.schema.json?flatten=true')
          .expect(200)
          .then(({ body }) => {
            body.should.eql([
              { path: [ 'meta', 'instanceID' ], type: 'string' },
              { path: [ 'name' ], type: 'string' },
              { path: [ 'age' ], type: 'int' }
            ]);
          }))));
  });

  describe('/:id GET', () => {
    it('should reject unless the user can read', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.get('/v1/forms/simple').expect(403))));

    it('should return basic form details', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.get('/v1/forms/simple')
          .expect(200)
          .then(({ body }) => {
            body.should.be.a.Form();
            body.xmlFormId.should.equal('simple');
          }))));

    it('should return extended form details', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/forms')
          .send(testData.forms.simple2)
          .set('Content-Type', 'application/xml')
          .expect(200)
          .then(() => asAlice.get('/v1/forms/simple2')
            .set('X-Extended-Metadata', 'true')
            .expect(200)
            .then(({ body }) => {
              body.should.be.an.ExtendedForm();
              body.xmlFormId.should.equal('simple2');
              body.submissions.should.equal(0);
              body.createdBy.should.be.an.Actor();
              body.createdBy.displayName.should.equal('Alice');
            })))));
  });

  describe('/:id PATCH', () => {
    it('should reject unless the user can update', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.patch('/v1/forms/simple')
          .send({ name: 'a new name!' })
          .expect(403))));

    it('should update allowed fields', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.patch('/v1/forms/simple')
          .send({ name: 'a fancy name', state: 'draft' })
          .expect(200)
          .then(() => asAlice.get('/v1/forms/simple')
            .expect(200)
            .then(({ body }) => {
              body.should.be.a.Form();
              body.name.should.equal('a fancy name');
              body.state.should.equal('draft');
              body.xml.should.equal(testData.forms.simple);
            })))));

    it('should reject if state is invalid', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.patch('/v1/forms/simple')
          .send({ name: 'a cool name', state: 'the coolest' })
          .expect(400))));

    it('should not update disallowed fields', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.patch('/v1/forms/simple')
          .send({ xmlFormId: 'changed', xml: 'changed', hash: 'changed' })
          .expect(200)
          .then(() => asAlice.get('/v1/forms/simple')
            .expect(200)
            .then(({ body }) => {
              body.xmlFormId.should.equal('simple');
              body.xml.should.equal(testData.forms.simple);
              body.hash.should.equal('5c09c21d4c71f2f13f6aa26227b2d133');
            })))));
  });

  describe('/:id DELETE', () => {
    it('should reject unless the user can delete', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.delete('/v1/forms/simple').expect(403))));

    it('should delete the form', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.delete('/v1/forms/simple')
          .expect(200)
          .then(() => asAlice.get('/v1/forms/simple')
            .expect(404)))));
  });
});

