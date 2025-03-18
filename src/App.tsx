import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import {
  id,
  solidityPacked,
  solidityPackedKeccak256,
  namehash,
  JsonRpcProvider,
  Contract,
  ContractRunner,
  getBytes,
  getBigInt,
  getAddress,
} from "ethers";

// CORS to: https://api.thegraph.com/subgraphs/name/ensdomains/ens
const SUBGRAPH_URL = `/api/subgraphs/name/ensdomains/ens`;

// Use public RPC URL
const provider = new JsonRpcProvider("https://ethereum-rpc.publicnode.com");

export class ResolverContract {
  private static abi = [
    "function addr(bytes32 node, uint coinType) public view returns(bytes memory)",
  ];

  public readonly address: string;
  private resolver: Contract;

  public static init(address: string, singer: ContractRunner) {
    const resolver = new Contract(
      address as string,
      ResolverContract.abi,
      singer
    );
    return new ResolverContract(resolver, address);
  }

  private constructor(resolver: Contract, address: string) {
    this.resolver = resolver;
    this.address = address;
  }

  public async addr(node: string, coinType: number): Promise<string> {
    return getAddress(
      await this.resolver.addr(getBytes(node), getBigInt(coinType))
    );
  }
}

function App() {
  const fetchDomain = async () => {
    const ens = "imtoken.eth";

    const subdomainsResult = await querySubdomainsFromId(getNameId(ens));
    const subdomains = subdomainsResult.data.domains.flatMap((domain) =>
      domain.subdomains.map((subdomain) => ({
        name: subdomain.name,
        id: subdomain.owner.id,
      }))
    );
    console.log(JSON.stringify(subdomains, null, 2));

    // Output:
    // [
    //   {
    //     name: "op.imtoken.eth",
    //     id: "0x4e88f436422075c1417357bf957764c127b2cc93",
    //   },
    // ];

    const resolverAndCoinTypesResult = await queryResolverAndCoinTypesFromId(
      getNameId(ens)
    );
    const { address: resolver, coinTypes: coinTypesString } =
      resolverAndCoinTypesResult?.data?.domains?.[0]?.resolver ?? {};

    const coinTypes = coinTypesString.map((coinType) => parseInt(coinType));
    const resolverContract = ResolverContract.init(resolver, provider);

    coinTypes.forEach(async (coinType) => {
      // Get owner from resolver contract
      const owner = await resolverContract.addr(getNameId(ens), coinType);
      console.log(`name: ${lookupCoinType(coinType)}\t owner: ${owner}`);
    });

    // Output:
    // name: eth	 owner: 0x4e88F436422075C1417357bF957764c127B2CC93
    // name: op	 owner: 0x4e88F436422075C1417357bF957764c127B2CC93
    // name: arb1	 owner: 0x4e88F436422075C1417357bF957764c127B2CC93
    // name: base	 owner: 0x4e88F436422075C1417357bF957764c127B2CC93
  };

  const getNameId = (ens: string): string => {
    const name = ens.split(".");
    const length = name.length;

    const nodeEth = namehash(name[length - 1]); // eth
    const idUsername = id(name[length - 2]); // username
    return solidityPackedKeccak256(
      ["bytes"],
      [solidityPacked(["bytes32", "bytes32"], [nodeEth, idUsername])]
    );
  };

  type Subdomains = {
    data: {
      domains: Domain[];
    };
  };

  type Domain = {
    subdomains: Subdomain[];
  };

  type Subdomain = {
    labelName: string;
    name: string;
    owner: Owner;
  };

  type Owner = {
    id: string;
  };

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getSubdomainsFormId+%7B%0A++domains%28%0A++++where%3A+%7Bid%3A+%220x6996a8ad70089179bc0bf29f3519f65d65359b22bb1c324c32c60020dbffe41c%22%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++%29+%7B%0A++++subdomains+%7B%0A++++++name%0A++++++labelName%0A++++++owner+%7B%0A++++++++id%0A++++++%7D%0A++++%7D%0A++%7D%0A%7D%0A
  const querySubdomainsFromId = async (id: string): Promise<Subdomains> => {
    const query = `
query getSubdomainsFormId {
  domains(
    where: {id: "${id.toLowerCase()}"}
    orderBy: createdAt
    orderDirection: desc
  ) {
    subdomains {
      name
      labelName
      owner {
        id
      }
    }
  }
}
`;
    return (await queryGraph(query, SUBGRAPH_URL)) as Subdomains;
  };

  type ResolverAndCoinTypes = {
    data: {
      domains: {
        resolver: {
          address: string;
          coinTypes: string[];
        };
      }[];
    };
  };

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getResolverAndCoinTypesFromId+%7B%0A++domains%28%0A++++where%3A+%7Bid%3A+%220x6996a8ad70089179bc0bf29f3519f65d65359b22bb1c324c32c60020dbffe41c%22%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++%29+%7B%0A++++resolver+%7B%0A++++++coinTypes%0A++++++address%0A++++%7D%0A++%7D%0A%7D%0A
  const queryResolverAndCoinTypesFromId = async (
    id: string
  ): Promise<ResolverAndCoinTypes> => {
    const query = `
query getResolverAndCoinTypesFromId {
  domains(
    where: {id: "${id.toLowerCase()}"}
    orderBy: createdAt
    orderDirection: desc
  ) {
    resolver {
      coinTypes
      address
    }
  }
}
`;
    return (await queryGraph(query, SUBGRAPH_URL)) as ResolverAndCoinTypes;
  };

  const lookupCoinType = (coinType: number) =>
    Object.entries(evmCoinNameToTypeMap).find(([k, v]) => v === coinType)?.[0];

  const evmCoinNameToTypeMap = {
    eth: 60,
    op: 2147483658,
    cro: 2147483673,
    bsc: 2147483704,
    go: 2147483708,
    etc: 2147483709,
    tomo: 2147483736,
    poa: 2147483747,
    gno: 2147483748,
    tt: 2147483756,
    matic: 2147483785,
    manta: 2147483817,
    ewt: 2147483894,
    ftm: 2147483898,
    boba: 2147483936,
    zksync: 2147483972,
    theta: 2147484009,
    clo: 2147484468,
    metis: 2147484736,
    mantle: 2147488648,
    base: 2147492101,
    nrg: 2147523445,
    arb1: 2147525809,
    celo: 2147525868,
    avaxc: 2147526762,
    linea: 2147542792,
    scr: 2148018000,
    zora: 2155261425,
  };

  const queryGraph = async (
    query: string,
    url: string
  ): Promise<any | null> => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(`Query failure: ${result.errors}`);
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Cannot query: ${errorMessage}`);
      return null;
    }
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div>
        <button onClick={fetchDomain}>fetch domain</button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
