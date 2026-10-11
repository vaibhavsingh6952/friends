import type { GithubGateway, RateLimitInfo, FriendData } from "../ports.js";
import type { RepositoryData, TopRepositoryData, LanguageData, LanguageEdge, DefaultBranchRef, CommitHistory, CommitNode, CommitAuthor, ContributionCalendar, ContributionWeek, ContributionDay } from "../domain/types.js";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const FOLLOWING_QUERY = `
  query Following($login: String!, $first: Int!) {
    user(login: $login) {
      login
      following(first: $first) {
        totalCount
        nodes {
          id
          login
        }
      }
    }
    rateLimit { limit cost remaining resetAt }
  }
`;

const FRIEND_DETAILS_QUERY = `
  query FriendDetails($ids: [ID!]!, $since: DateTime!) {
    nodes(ids: $ids) {
      ... on User {
        login
        name
        avatarUrl
        url
        month: contributionsCollection(from: $since) {
          totalCommitContributions
        }
        year: contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
        repositories(first: 10, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
          nodes {
            name
            url
            stargazerCount
            pushedAt
            primaryLanguage { name color }
            languages(first: 4, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name color } }
            }
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 3) {
                    nodes {
                      oid
                      messageHeadline
                      committedDate
                      url
                      author { user { login } }
                    }
                  }
                }
              }
            }
          }
        }
        top: repositories(first: 5, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }) {
          nodes {
            name
            url
            stargazerCount
            primaryLanguage { name color }
          }
        }
      }
    }
    rateLimit { limit cost remaining resetAt }
  }
`;

function mapRateLimit(data: any): RateLimitInfo {
  return {
    limit: data.limit,
    cost: data.cost,
    remaining: data.remaining,
    resetAt: data.resetAt,
  };
}

function mapRepository(node: any): RepositoryData {
  return {
    name: node.name,
    url: node.url,
    stargazerCount: node.stargazerCount,
    pushedAt: node.pushedAt,
    primaryLanguage: node.primaryLanguage ? { name: node.primaryLanguage.name, color: node.primaryLanguage.color } : null,
    languages: node.languages?.edges?.map((e: any) => ({ size: e.size, node: { name: e.node.name, color: e.node.color } })) ?? [],
    defaultBranchRef: node.defaultBranchRef?.target?.history?.nodes
      ? {
          target: {
            nodes: node.defaultBranchRef.target.history.nodes.map((c: any) => ({
              oid: c.oid,
              messageHeadline: c.messageHeadline,
              committedDate: c.committedDate,
              url: c.url,
              author: { user: c.author.user ? { login: c.author.user.login } : null },
            })),
          },
        }
      : null,
  };
}

function mapTopRepository(node: any): TopRepositoryData {
  return {
    name: node.name,
    url: node.url,
    stargazerCount: node.stargazerCount,
    primaryLanguage: node.primaryLanguage ? { name: node.primaryLanguage.name, color: node.primaryLanguage.color } : null,
  };
}

function mapFriend(node: any): FriendData | null {
  if (!node) return null;
  return {
    login: node.login,
    name: node.name,
    avatarUrl: node.avatarUrl,
    url: node.url,
    totalCommitContributions: node.month?.totalCommitContributions ?? 0,
    repositories: node.repositories?.nodes?.map(mapRepository) ?? [],
    topRepositories: node.top?.nodes?.map(mapTopRepository) ?? [],
    contributionCalendar: {
      weeks: node.year?.contributionCalendar?.weeks?.map((w: any) => ({
        contributionDays: w.contributionDays?.map((d: any) => ({ date: d.date, contributionCount: d.contributionCount })) ?? [],
      })) ?? [],
    },
    rateLimit: { limit: 0, cost: 0, remaining: 0, resetAt: "" },
  };
}

export class GithubGraphqlGateway implements GithubGateway {
  constructor(private readonly token: string) {}

  async fetchFollowing(login: string, limit: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "User-Agent": "friends-dashboard",
        },
        body: JSON.stringify({ query: FOLLOWING_QUERY, variables: { login, first: limit } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const json = await res.json();
      if (json.errors) throw new Error(json.errors.map((e: any) => e.message).join(", "));
      return {
        user: json.data.user,
        rateLimit: mapRateLimit(json.data.rateLimit),
      };
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async fetchFriendDetails(ids: string[], since: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "User-Agent": "friends-dashboard",
        },
        body: JSON.stringify({ query: FRIEND_DETAILS_QUERY, variables: { ids, since } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const json = await res.json();
      if (json.errors) throw new Error(json.errors.map((e: any) => e.message).join(", "));
      return {
        nodes: json.data.nodes.map(mapFriend),
        rateLimit: mapRateLimit(json.data.rateLimit),
      };
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }
}