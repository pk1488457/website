// Wraps a Mongoose Query + the raw req.query params to apply filtering,
// sorting, field selection, and pagination in a consistent way across
// every "list" endpoint (jobs, applications, admin lists, etc.) instead
// of re-implementing this logic per controller.
class QueryBuilder {
  constructor(query, queryParams) {
    this.query = query;
    this.queryParams = queryParams;
  }

  filter() {
    const queryCopy = { ...this.queryParams };
    const excludedFields = ['select', 'sort', 'page', 'limit', 'keyword'];
    excludedFields.forEach((field) => delete queryCopy[field]);

    // Support gte/gt/lte/lt operators, e.g. ?experienceMin[gte]=2
    let queryStr = JSON.stringify(queryCopy);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  search(fields = []) {
    if (this.queryParams.keyword) {
      // Uses the text index defined on the Job model for fast keyword
      // search rather than a $regex scan across every document.
      this.query = this.query.find({ $text: { $search: this.queryParams.keyword } });
    }
    return this;
  }

  sort() {
    if (this.queryParams.sort) {
      const sortBy = this.queryParams.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  select() {
    if (this.queryParams.select) {
      const fields = this.queryParams.select.split(',').join(' ');
      this.query = this.query.select(fields);
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryParams.page, 10) || 1;
    const limit = Math.min(parseInt(this.queryParams.limit, 10) || 10, 50); // cap at 50/page
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit, skip };
    return this;
  }
}

module.exports = QueryBuilder;
