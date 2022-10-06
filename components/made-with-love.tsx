import { GithubIcon } from "./icons";

export function MadeWithLove() {
  return (
    <div className="flex flex-col justify-center items-center text-center">
      <a
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-primary"
        href="https://github.com/21e8/cryptostraps.tools/"
      >
        <i>
          <GithubIcon />
        </i>
      </a>
    </div>
  );
}
